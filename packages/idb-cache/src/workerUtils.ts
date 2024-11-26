import type {
  EncryptedChunk,
  ExtendedPendingRequest,
  WorkerMessage,
  WorkerResponse,
  WorkerResponseType,
} from "./types";
import {
  WorkerInitializationError,
  TimeoutError,
  DecryptionError,
  EncryptionError,
  CryptoError,
  IDBCacheError,
} from "./errors";

/**
 * Utility type guards for Worker responses
 */
function isReadyResponse(
  message: WorkerResponse
): message is { type: "ready" } {
  return message.type === "ready";
}

function isInitErrorResponse(
  message: WorkerResponse
): message is { type: "initError"; error: string } {
  return message.type === "initError";
}

function isEncryptResultResponse(message: WorkerResponse): message is {
  requestId: string;
  type: "encryptResult";
  result: EncryptedChunk;
} {
  return (
    message.type === "encryptResult" && typeof message.requestId === "string"
  );
}

function isDecryptResultResponse(
  message: WorkerResponse
): message is { requestId: string; type: "decryptResult"; result: string } {
  return (
    message.type === "decryptResult" && typeof message.requestId === "string"
  );
}

function isErrorResponse(
  message: WorkerResponse
): message is { requestId: string; type: "error"; error: string } {
  return message.type === "error" && typeof message.requestId === "string";
}

/**
 * Creates a SharedWorker from a given function and sets up initial communication.
 * @param fn - The worker function to execute.
 * @param rejectAll - Function to call to reject all pending requests in case of failure.
 * @returns An object containing the worker instance and its message port.
 */
export function createWorkerFromFunction(
  fn: () => void,
  rejectAll: (errorMessage: string) => void
): {
  worker: SharedWorker;
  port: MessagePort;
} {
  const scriptSource = `(${fn.toString()})()`;
  const base64Source = btoa(scriptSource);
  const url = `data:application/javascript;base64,${base64Source}`;
  const worker = new SharedWorker(url, {
    name: "idb-cache-worker",
  });

  const port = worker.port;

  port.start();

  worker.onerror = (event) => {
    console.error("SharedWorker encountered an error:", event.message);
    rejectAll("SharedWorker encountered an error and was terminated.");
    worker.port.close();
  };

  port.onmessageerror = () => {
    console.warn(
      "MessagePort encountered a message error. SharedWorker may have been terminated."
    );
    rejectAll("SharedWorker was terminated unexpectedly.");
    port.close();
  };

  return { worker, port };
}

/**
 * Rejects all pending requests with a specific error message.
 * @param pendingRequests - Map of pending requests.
 * @param errorMessage - The error message to reject with.
 */
export function rejectAllPendingRequests(
  pendingRequests: Map<string, ExtendedPendingRequest<EncryptedChunk | string>>,
  errorMessage: string
) {
  pendingRequests.forEach((pending, requestId) => {
    pending.reject(new WorkerInitializationError(errorMessage));
    clearTimeout(pending.timer);
    pendingRequests.delete(requestId);
  });
}

/**
 * Initializes the worker by setting up message handlers for responses and errors.
 * @param port - The MessagePort instance for communication.
 * @param resolveReady - Function to call when the worker is ready.
 * @param rejectReady - Function to call if the worker fails to initialize.
 * @param pendingRequests - Map of pending requests awaiting responses.
 */
export function initializeWorker(
  port: MessagePort,
  resolveReady: () => void,
  rejectReady: (reason?: unknown) => void,
  pendingRequests: Map<string, ExtendedPendingRequest<EncryptedChunk | string>>
) {
  port.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const message = e.data;

    if (isReadyResponse(message)) {
      resolveReady();
    } else if (isInitErrorResponse(message)) {
      const error = new WorkerInitializationError(message.error);
      rejectReady(error);
      rejectAllPendingRequests(pendingRequests, message.error);
    } else if (isEncryptResultResponse(message)) {
      const { requestId, result } = message;
      const pending = pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolve(result);
        pendingRequests.delete(requestId);
      }
    } else if (isDecryptResultResponse(message)) {
      const { requestId, result } = message;
      const pending = pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolve(result);
        pendingRequests.delete(requestId);
      }
    } else if (isErrorResponse(message)) {
      const { requestId, error } = message;
      const pending = pendingRequests.get(requestId);
      if (pending) {
        let customError: IDBCacheError;
        const errorLower = error.toLowerCase();
        if (errorLower.includes("encrypt")) {
          customError = new EncryptionError(error);
        } else if (errorLower.includes("decrypt")) {
          customError = new DecryptionError(error);
        } else if (errorLower.includes("key")) {
          customError = new CryptoError(error);
        } else {
          customError = new IDBCacheError(error);
        }
        clearTimeout(pending.timer);
        pending.reject(customError);
        pendingRequests.delete(requestId);
      }
    } else {
      console.warn(
        "WorkerUtils: Unknown message type received. Ignoring the message.",
        message
      );
    }
  };

  port.onmessageerror = (e: MessageEvent) => {
    console.error("SharedWorker encountered a message error:", e);
    const error = new WorkerInitializationError(
      "SharedWorker failed to communicate properly."
    );
    rejectReady(error);
    rejectAllPendingRequests(
      pendingRequests,
      "SharedWorker encountered an error and was terminated."
    );
    port.close();
  };
}

/**
 * Sends a message to the worker via the MessagePort and handles the response.
 * @param port - The MessagePort instance for communication.
 * @param requestId - Unique identifier for the request.
 * @param message - The message to send to the worker.
 * @param pendingRequests - Map of pending requests awaiting responses.
 * @param transferable - Optional array of Transferable objects to transfer.
 * @param timeout - Timeout duration in milliseconds.
 * @returns A promise that resolves with the worker's response.
 */
export async function sendMessageToWorker<T extends WorkerMessage["type"]>(
  port: MessagePort,
  requestId: string,
  message: Extract<WorkerMessage, { type: T }>,
  pendingRequests: Map<string, ExtendedPendingRequest<WorkerResponseType<T>>>,
  transferable?: Transferable[],
  timeout = 5000
): Promise<WorkerResponseType<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pending.reject(new TimeoutError("Request timed out"));
        pendingRequests.delete(requestId);
      }
    }, timeout);

    pendingRequests.set(requestId, { resolve, reject, timer });

    const transferables: Transferable[] = [];

    if (transferable && transferable.length > 0) {
      transferables.push(...transferable);
    }

    try {
      if (transferables.length > 0) {
        port.postMessage(message, transferables);
      } else {
        port.postMessage(message);
      }
    } catch (error) {
      console.error("Failed to post message to SharedWorker:", error);
      const pending = pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(
          new WorkerInitializationError(
            "Failed to communicate with the SharedWorker."
          )
        );
        pendingRequests.delete(requestId);
      }
      return;
    }
  });
}
