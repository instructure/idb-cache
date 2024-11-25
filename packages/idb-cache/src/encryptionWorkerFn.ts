/// <reference lib="webworker" />
// This file should remain independent, with only type-imports

import type { WorkerMessage } from "./types";

declare const self: SharedWorkerGlobalScope;

export function encryptionWorkerFunction() {
  let cacheKey: Uint8Array | null = null;
  const derivedKeyCache: Map<string, CryptoKey> = new Map();
  let pbkdf2Iterations = 100000;
  let fixedSalt: ArrayBuffer | null = null;

  async function getKeyFromCacheKey(
    cacheKeyBuffer: Uint8Array
  ): Promise<CryptoKey> {
    if (!fixedSalt) {
      throw new Error("Fixed salt (cacheBuster) not initialized");
    }

    const cacheKeyString = `${new TextDecoder().decode(
      cacheKeyBuffer
    )}-${new TextDecoder().decode(new Uint8Array(fixedSalt))}`;

    if (derivedKeyCache.has(cacheKeyString)) {
      const result = derivedKeyCache.get(cacheKeyString);
      if (result !== undefined) {
        return result;
      }
    }

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      cacheKeyBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: fixedSalt,
        iterations: pbkdf2Iterations,
        hash: "SHA-512",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    derivedKeyCache.set(cacheKeyString, derivedKey);

    return derivedKey;
  }

  async function initializeKey() {
    if (!cacheKey) {
      throw new Error("Cache key not provided for encryption worker");
    }
    try {
      for (const port of ports) {
        port.postMessage({ type: "ready" });
      }
    } catch (error: unknown) {
      console.error("Worker: Failed to initialize AES key:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown initialization error";
      for (const port of ports) {
        port.postMessage({ type: "initError", error: errorMessage });
      }
    }
  }

  async function encrypt(value: string): Promise<{
    iv: ArrayBuffer;
    ciphertext: ArrayBuffer;
  }> {
    if (!cacheKey) throw new Error("Cache key not initialized");
    if (!fixedSalt) throw new Error("Fixed salt (cacheBuster) not initialized");

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const key = await getKeyFromCacheKey(cacheKey);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(value)
    );

    return {
      iv: iv.buffer,
      ciphertext: ciphertext,
    };
  }

  async function decrypt(
    iv: ArrayBuffer,
    ciphertext: ArrayBuffer
  ): Promise<string> {
    if (!cacheKey) throw new Error("AES key not initialized");
    if (!fixedSalt) throw new Error("Fixed salt (cacheBuster) not initialized");

    const ivArray = new Uint8Array(iv);

    const key = await getKeyFromCacheKey(cacheKey);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivArray },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  const taskQueue: Array<() => Promise<void>> = [];
  let currentParallelism = 1;
  const MAX_PARALLELISM = 10;
  const MIN_PARALLELISM = 1;
  const INCREASE_THRESHOLD = 40; // ms
  const DECREASE_THRESHOLD = 80; // ms

  let activeTasks = 0;

  function enqueueTask(task: () => Promise<void>) {
    taskQueue.push(task);
    processQueue();
  }

  async function processQueue() {
    while (activeTasks < currentParallelism && taskQueue.length > 0) {
      const task = taskQueue.shift();
      if (task) {
        activeTasks++;
        (async () => {
          const startTime = performance.now();
          try {
            await task();
          } catch (error) {
            console.error("Worker: Task execution error:", error);
          } finally {
            const endTime = performance.now();
            const duration = endTime - startTime;
            adjustParallelism(duration);
            activeTasks--;
            processQueue();
          }
        })();
      }
    }
  }

  function adjustParallelism(duration: number) {
    if (duration < INCREASE_THRESHOLD && currentParallelism < MAX_PARALLELISM) {
      currentParallelism++;
    } else if (
      duration > DECREASE_THRESHOLD &&
      currentParallelism > MIN_PARALLELISM
    ) {
      currentParallelism--;
    }
  }

  function handleEncrypt(requestId: string, value: string, port: MessagePort) {
    enqueueTask(async () => {
      try {
        const encrypted = await encrypt(value);
        if (!port) throw new Error("MessagePort is not available");

        port.postMessage(
          {
            requestId,
            type: "encryptResult",
            result: encrypted,
          },
          [encrypted.iv, encrypted.ciphertext]
        );
      } catch (error: unknown) {
        console.error("Worker: Encryption error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown encryption error";
        if (port) {
          port.postMessage({ requestId, type: "error", error: errorMessage });
        }
      }
    });
  }

  function handleDecrypt(
    requestId: string,
    iv: ArrayBuffer,
    ciphertext: ArrayBuffer,
    port: MessagePort
  ) {
    enqueueTask(async () => {
      try {
        const decrypted = await decrypt(iv, ciphertext);
        if (!port) throw new Error("MessagePort is not available");

        port.postMessage({
          requestId,
          type: "decryptResult",
          result: decrypted,
        });
      } catch (error: unknown) {
        console.error("Worker: Decryption error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown decryption error";
        if (port) {
          port.postMessage({ requestId, type: "error", error: errorMessage });
        }
      }
    });
  }

  const ports: MessagePort[] = [];

  function onConnect(e: MessageEvent) {
    const port = e.ports[0];
    ports.push(port);
    port.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { type, payload, requestId } = event.data;

      switch (type) {
        case "initialize":
          {
            const {
              cacheKey: incomingCacheKey,
              pbkdf2Iterations: incomingIterations,
              cacheBuster,
            } = payload;
            cacheKey = new TextEncoder().encode(incomingCacheKey);
            pbkdf2Iterations = incomingIterations || 100000;
            fixedSalt = new TextEncoder().encode(cacheBuster).buffer;
            initializeKey().catch((error) => {
              console.error("Worker: Initialization failed:", error);
            });
          }
          break;

        case "encrypt":
          {
            const { value } = payload;
            handleEncrypt(requestId, value, port);
          }
          break;

        case "decrypt":
          {
            const { iv, ciphertext } = payload;
            handleDecrypt(requestId, iv, ciphertext, port);
          }
          break;

        case "destroy":
          {
            if (cacheKey) {
              cacheKey.fill(0);
              cacheKey = null;
            }
            if (fixedSalt) {
              const saltArray = new Uint8Array(fixedSalt);
              saltArray.fill(0);
              fixedSalt = null;
            }
            for (const p of ports) {
              p.close();
            }
            self.close();
          }
          break;

        default:
          console.warn(
            `Worker: Unknown message type received: ${type}. Ignoring the message.`
          );
      }
    };
    port.start();
  }

  self.onconnect = onConnect;
}
