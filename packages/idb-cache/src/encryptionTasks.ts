import type { EncryptedChunk, ExtendedPendingRequest } from "./types";
import { sendMessageToWorker } from "./workerUtils";
import {
  WorkerInitializationError,
  EncryptionError,
  DecryptionError,
  IDBCacheError,
} from "./errors";

/**
 * Encrypts a chunk of data using the worker.
 * @param port - The MessagePort instance.
 * @param value - The plaintext string to encrypt.
 * @param pendingRequests - Map of pending requests awaiting responses.
 * @returns An encrypted chunk containing IV and ciphertext as ArrayBuffers.
 * @throws {WorkerInitializationError} If the worker is not initialized properly.
 * @throws {EncryptionError} If encryption fails.
 */
export async function encryptChunk(
  port: MessagePort,
  value: string,
  pendingRequests: Map<string, ExtendedPendingRequest<EncryptedChunk>>
): Promise<EncryptedChunk> {
  const requestId = crypto.randomUUID();
  try {
    const encrypted = await sendMessageToWorker<"encrypt">(
      port,
      requestId,
      { requestId, type: "encrypt", payload: { value } },
      pendingRequests,
      [],
      5000
    );

    return encrypted;
  } catch (error) {
    if (error instanceof WorkerInitializationError) {
      throw error;
    }
    if (error instanceof EncryptionError) {
      throw error;
    }
    if (error instanceof IDBCacheError) {
      throw error;
    }
    throw new EncryptionError(
      error instanceof Error ? error.message : "Unknown encryption error"
    );
  }
}

/**
 * Decrypts a chunk of data using the worker.
 * @param port - The MessagePort instance.
 * @param iv - The Initialization Vector used during encryption.
 * @param ciphertext - The encrypted data.
 * @param pendingRequests - Map of pending requests awaiting responses.
 * @returns The decrypted plaintext string.
 * @throws {WorkerInitializationError} If the worker is not initialized properly.
 * @throws {DecryptionError} If decryption fails.
 */
export async function decryptChunk(
  port: MessagePort,
  iv: ArrayBuffer,
  ciphertext: ArrayBuffer,
  pendingRequests: Map<string, ExtendedPendingRequest<string>>
): Promise<string> {
  const requestId = crypto.randomUUID();
  try {
    const decrypted = await sendMessageToWorker<"decrypt">(
      port,
      requestId,
      {
        requestId,
        type: "decrypt",
        payload: { iv, ciphertext },
      },
      pendingRequests,
      [iv, ciphertext],
      5000
    );
    return decrypted;
  } catch (error) {
    if (error instanceof WorkerInitializationError) {
      throw error;
    }
    if (error instanceof DecryptionError) {
      throw error;
    }
    if (error instanceof IDBCacheError) {
      throw error;
    }
    throw new DecryptionError(
      error instanceof Error ? error.message : "Unknown decryption error"
    );
  }
}
