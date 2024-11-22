import { uuid } from "./utils";

interface WorkerMessage {
  requestId: string;
  targetSizeInBytes: number;
  seed: string;
}

interface WorkerResponse {
  requestId: string;
  text: string;
}

/**
 * Generates the Worker code as a string using the Function.prototype.toString() strategy.
 * This ensures that the Worker code is self-contained and not transformed by the bundler.
 * The worker code is written as a function and then converted to a string.
 */
function generateTextOfSizeWorkerCode(): string {
  const workerFunction = () => {
    // Define types for internal worker usage
    interface WorkerMessage {
      requestId: string;
      targetSizeInBytes: number;
      seed: string;
    }

    interface WorkerResponse {
      requestId: string;
      text: string;
    }

    /**
     * Utility function to convert a seed string into a numerical hash.
     *
     * @param str - The seed string to hash.
     * @returns A numerical hash derived from the input string.
     */
    function hashCode(str: string): number {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0; // Ensure unsigned 32-bit integer
      }
      return hash;
    }

    /**
     * Seeded pseudo-random number generator using Linear Congruential Generator (LCG).
     *
     * @param seed - The seed string to initialize the generator.
     * @returns A function that generates a pseudo-random number between 0 (inclusive) and 1 (exclusive).
     */
    function seededRandom(seed: string): () => number {
      let state: number = hashCode(seed);
      const a: number = 1664525;
      const c: number = 1013904223;
      const m: number = 2 ** 32;

      /**
       * Generates the next pseudo-random number in the sequence.
       *
       * @returns A pseudo-random number between 0 (inclusive) and 1 (exclusive).
       */
      function random(): number {
        state = (a * state + c) >>> 0; // Update state with LCG formula
        return state / m;
      }

      return random;
    }

    /**
     * Calculates the byte size of a string using UTF-8 encoding.
     *
     * @param str - The string whose byte size is to be calculated.
     * @returns The byte size of the input string.
     */
    function calculateByteSize(str: string): number {
      return new TextEncoder().encode(str).length;
    }

    /**
     * Listener for messages from the main thread.
     * Generates a deterministic random text string based on the provided seed and target size.
     */
    self.onmessage = (event: MessageEvent): void => {
      const data: WorkerMessage = event.data;
      const { requestId, targetSizeInBytes, seed } = data;

      const rand: () => number = seededRandom(seed);
      const estimatedChars: number = Math.ceil(targetSizeInBytes);
      const charArray: string[] = new Array(estimatedChars);

      for (let i = 0; i < estimatedChars; i++) {
        // Generate a random printable ASCII character (codes 33 to 126)
        charArray[i] = String.fromCharCode(33 + Math.floor(rand() * 94));
      }

      let result: string = charArray.join("");

      // Ensure the generated result matches the exact target size
      while (calculateByteSize(result) > targetSizeInBytes) {
        result = result.slice(0, -1);
      }

      const response: WorkerResponse = { requestId, text: result };
      // Send the generated text back to the main thread
      postMessage(response);
    };
  };

  // Convert the worker function to a string and invoke it immediately
  return `(${workerFunction.toString()})();`;
}

/**
 * Creates a Web Worker from a given code string by converting it to a Blob URL.
 *
 * @param code The Worker code as a string.
 * @returns A new Worker instance.
 */
function createWorkerFromCode(code: string): Worker {
  const blob: Blob = new Blob([code], { type: "application/javascript" });
  const blobURL: string = URL.createObjectURL(blob);
  return new Worker(blobURL);
}

/**
 * Asynchronously generates a deterministic random text string of a specified byte size
 * by offloading the task to a Web Worker. Supports multiple concurrent requests using requestId.
 *
 * @param targetSizeInBytes The desired byte size of the generated string.
 * @param seed Optional seed for the random number generator. Defaults to "default".
 * @returns A Promise that resolves to the generated string.
 */
export async function generateTextOfSize(
  targetSizeInBytes: number,
  seed = "default"
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const requestId: string = uuid();

    // Generate the worker code and create a new worker
    const workerCode: string = generateTextOfSizeWorkerCode();
    const worker: Worker = createWorkerFromCode(workerCode);

    /**
     * Handler for messages from the worker.
     * Resolves the promise if the response matches the requestId.
     */
    const handleMessage = (event: MessageEvent): void => {
      const data: WorkerResponse = event.data;
      if (data.requestId === requestId) {
        resolve(data.text);
        cleanup();
      }
    };

    /**
     * Handler for errors from the worker.
     * Rejects the promise and cleans up the worker.
     */
    const handleError = (error: ErrorEvent): void => {
      reject(error);
      cleanup();
    };

    /**
     * Cleans up event listeners and terminates the worker.
     */
    const cleanup = (): void => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
    };

    // Attach event listeners
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    // Send the message with the requestId
    const message: WorkerMessage = { requestId, targetSizeInBytes, seed };
    worker.postMessage(message);
  });
}
