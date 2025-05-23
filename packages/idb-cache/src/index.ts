import { decryptChunk, encryptChunk } from "./encryptionTasks";
import type {
  EncryptedChunk,
  ExtendedPendingRequest,
  IDBCacheSchema,
  STORE,
} from "./types";
import {
  generateChunkKey,
  openDatabase,
  parseChunkIndexFromKey,
  getAllChunkKeysForBaseKey,
  deterministicUUID,
  waitForAnimationFrame,
} from "./utils";
import { encryptionWorkerFunction } from "./encryptionWorkerFn";
import {
  createWorkerFromFunction,
  initializeWorker,
  rejectAllPendingRequests,
} from "./workerUtils";
import {
  DatabaseError,
  CryptoError,
  WorkerInitializationError,
  DecryptionError,
  EncryptionError,
  IDBCacheError,
} from "./errors";

export interface AsyncStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export interface IDBCacheInterface extends AsyncStorage {
  destroy: (options?: { clearData?: boolean }) => Promise<void>;
  cleanup: () => Promise<void>;
  count: () => Promise<number>;
}

export interface IDBCacheConfig {
  /**
   * Sensitive identifier used for securely encrypting data.
   */
  cacheKey?: string;
  /**
   * Unique value (not sensitive) used to invalidate old cache entries.
   */
  cacheBuster?: string;
  /**
   * Size of each chunk in bytes. When an item exceeds this size,
   * it splits into multiple chunks. Defaults to 25000 bytes.
   */
  chunkSize?: number;
  /**
   * Milliseconds between cleanup operations to remove expired
   * or surplus cached items.
   */
  cleanupInterval?: number;
  /**
   * Name of the IndexedDB database used for caching.
   * Defaults to "idb-cache" if not specified.
   */
  dbName?: string;
  /**
   * Enables detailed logging for debugging purposes
   * when set to true.
   */
  debug?: boolean;
  /**
   * Milliseconds after which cached items are considered eligible for removal.
   */
  maxAge?: number;
  /**
   * The maximum number of chunks to store in the cache. During cleanup,
   * idb-cache removes the oldest excess chunks. Defaults to undefined,
   * meaning no limit.
   */
  maxTotalChunks?: number;
  /**
   * Iterations used in the encryption algorithm to strengthen cryptographic keys.
   * More iterations increase security but also processing time.
   */
  pbkdf2Iterations?: number;
  /**
   * Low priority slightly delays start of operations to reduce load on the event loop.
   */
  priority?: "normal" | "low";
  /**
   * Controls whether to use SharedWorker or Worker for encryption/decryption.
   * When true (default), uses SharedWorker if available.
   * When false, always uses Worker even if SharedWorker is available.
   */
  useSharedWorker?: boolean;
}

const DB_VERSION = 2;
const DEFAULT_CHUNK_SIZE = 25000; // recommendation: keep under 100KiB (cf. https://surma.dev/things/is-postmessage-slow/)
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_PBKDF2_ITERATIONS = 100000;
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
const DURATION_THRESHOLD = 200;

const isSubtleCryptoSupported = crypto?.subtle;

export class IDBCache implements IDBCacheInterface {
  dbReadyPromise: Promise<import("idb").IDBPDatabase<IDBCacheSchema>>;
  private storeName: STORE;
  private worker: SharedWorker | Worker | null = null;
  private port: MessagePort | Worker | null = null;
  private pendingRequests: Map<
    string,
    ExtendedPendingRequest<EncryptedChunk | string>
  >;
  private workerReadyPromise: Promise<void> | null = null;
  private workerInitializationFailed = false;
  private maxAge: number;
  private cleanupIntervalId: number | undefined;

  private cacheKey?: string;
  private cacheBuster: string;
  private chunkSize: number;
  private cleanupInterval: number;
  private pbkdf2Iterations: number;
  private debug: boolean;
  private maxTotalChunks?: number;
  private priority: "normal" | "low" = "normal";
  private useSharedWorker: boolean;

  constructor(config: IDBCacheConfig) {
    const {
      cacheKey,
      cacheBuster,
      debug = false,
      dbName = "idb-cache",
      maxAge = DEFAULT_MAX_AGE,
      chunkSize = DEFAULT_CHUNK_SIZE,
      cleanupInterval = CLEANUP_INTERVAL,
      pbkdf2Iterations = DEFAULT_PBKDF2_ITERATIONS,
      maxTotalChunks,
      priority = "normal",
      useSharedWorker = true,
    } = config;

    this.storeName = "cache";
    this.cacheKey = cacheKey;
    this.cacheBuster = cacheBuster || "";
    this.debug = debug;
    this.maxAge = maxAge;
    this.chunkSize = chunkSize;
    this.cleanupInterval = cleanupInterval;
    this.pbkdf2Iterations = pbkdf2Iterations;
    this.maxTotalChunks = maxTotalChunks;
    this.pendingRequests = new Map();
    this.priority = priority;
    this.useSharedWorker = useSharedWorker;

    if (!window.indexedDB)
      throw new DatabaseError("IndexedDB is not supported.");
    if (!isSubtleCryptoSupported) {
      throw new CryptoError("Web Crypto API not available in this environment");
    }

    this.dbReadyPromise = openDatabase<IDBCacheSchema>(
      dbName,
      this.storeName,
      DB_VERSION
    );

    this.cleanupIntervalId = window.setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.error("Error during cleanup:", error);
      }
    }, this.cleanupInterval);

    this.initWorker(cacheKey, cacheBuster)
      .then(() => {
        setTimeout(() => {
          this.cleanup().catch((error) =>
            console.error("Initial cleanup failed:", error)
          );
        }, 10000);
      })
      .catch((error) => {
        this.workerInitializationFailed = true;
        console.warn("Worker initialization failed:", error);
      });
  }

  /**
   * Initializes the SharedWorker by creating it, setting up communication, and handling initialization.
   * @param cacheKey - The cache key used for encryption/decryption.
   * @param cacheBuster - The cacheBuster used as a fixed salt.
   * @throws {WorkerInitializationError} If the worker fails to initialize.
   */
  private async initWorker(
    cacheKey?: string,
    cacheBuster?: string
  ): Promise<void> {
    if (this.workerReadyPromise) {
      return this.workerReadyPromise;
    }
    this.workerReadyPromise = new Promise<void>((resolve, reject) => {
      const rejectAll = (errorMessage: string) => {
        this.workerInitializationFailed = true;
        reject(new WorkerInitializationError(errorMessage));
        rejectAllPendingRequests(this.pendingRequests, errorMessage);
      };

      const { worker, port } = createWorkerFromFunction(
        encryptionWorkerFunction,
        rejectAll,
        this.useSharedWorker
      );

      this.worker = worker;
      this.port = port;

      initializeWorker(port, resolve, reject, this.pendingRequests);

      port.postMessage({
        type: "initialize",
        payload: {
          cacheKey,
          cacheBuster,
          pbkdf2Iterations: this.pbkdf2Iterations,
        },
      });
    });

    try {
      await this.workerReadyPromise;
    } catch (error) {
      if (error instanceof IDBCacheError) {
        throw error;
      }
      this.workerInitializationFailed = true;
      throw new WorkerInitializationError("Worker failed to initialize.");
    }
  }

  /**
   * Cleans up the cache by removing expired items, flushing busted cache items,
   * and enforcing the maxTotalChunks limit.
   * @throws {DatabaseError} If there is an issue accessing the database.
   */
  public async cleanup(): Promise<void> {
    try {
      const db = await this.dbReadyPromise;
      if (this.priority === "low") {
        await waitForAnimationFrame();
      }
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.store;
      const timestampIndex = store.index("byTimestamp");
      const cacheBusterIndex = store.index("byCacheBuster");
      const now = Date.now();

      // 1. Remove expired items
      let cursor = await timestampIndex.openCursor();
      while (cursor) {
        const { timestamp } = cursor.value;
        if (timestamp <= now) {
          const age = now - timestamp;
          if (this.debug) {
            console.debug(
              `Deleting expired item with timestamp ${timestamp}. It is ${age}ms older than the expiration.`
            );
          }
          await cursor.delete();
        } else {
          break;
        }
        cursor = await cursor.continue();
      }

      // 2. Flush busted cache items
      const currentCacheBuster = this.cacheBuster;

      const lowerBoundRange = IDBKeyRange.upperBound(currentCacheBuster, true);
      const upperBoundRange = IDBKeyRange.lowerBound(currentCacheBuster, true);

      const deleteItemsInRange = async (range: IDBKeyRange) => {
        let itemsDeleted = 0;
        let rangeCursor = await cacheBusterIndex.openCursor(range);
        while (rangeCursor) {
          if (this.debug) {
            console.debug(
              "Deleting item with cacheBuster:",
              rangeCursor.value.cacheBuster
            );
          }
          await rangeCursor.delete();
          itemsDeleted++;
          rangeCursor = await rangeCursor.continue();
        }
        return itemsDeleted;
      };

      const itemsDeleted = await Promise.all([
        deleteItemsInRange(lowerBoundRange),
        deleteItemsInRange(upperBoundRange),
      ]);

      // 3. Enforce maxTotalChunks limit
      if (this.maxTotalChunks !== undefined) {
        const totalChunks = await store.count();
        if (totalChunks > this.maxTotalChunks) {
          let excess = totalChunks - this.maxTotalChunks;
          if (this.debug) {
            console.debug(
              `Total chunks (${totalChunks}) exceed maxTotalChunks (${this.maxTotalChunks}). Deleting entire items until excess (${excess}) is removed.`
            );
          }

          const baseKeysToDelete: string[] = [];
          const chunkKeysToDelete: string[] = [];

          let cursor = await timestampIndex.openCursor(null, "next"); // Ascending order
          while (cursor && excess > 0) {
            const key = cursor.value.key;
            const baseKeyMatch = key.match(/^(.*)-chunk-\d{6}-.*/);
            if (!baseKeyMatch) {
              cursor = await cursor.continue();
              continue;
            }
            const baseKey = baseKeyMatch[1];
            if (baseKeysToDelete.includes(baseKey)) {
              cursor = await cursor.continue();
              continue;
            }

            // Define key range for this baseKey
            const lowerBound = `${baseKey}-chunk-000000-`;
            const upperBound = `${baseKey}-chunk-999999￿`;
            const range = IDBKeyRange.bound(
              lowerBound,
              upperBound,
              false,
              false
            );

            // Collect all chunkKeys for this baseKey
            const chunkKeys: string[] = [];
            let chunkCursor = await store.openCursor(range);
            while (chunkCursor) {
              chunkKeys.push(chunkCursor.value.key);
              chunkCursor = await chunkCursor.continue();
            }

            // Add all chunkKeys to be deleted
            chunkKeysToDelete.push(...chunkKeys);

            // Decrement excess by the number of chunks
            excess -= chunkKeys.length;

            baseKeysToDelete.push(baseKey);
            cursor = await cursor.continue();
          }

          // Delete all collected chunkKeys
          for (const chunkKey of chunkKeysToDelete) {
            await store.delete(chunkKey);
            if (this.debug) {
              console.debug(`Deleted chunk ${chunkKey}.`);
            }
          }

          if (this.debug) {
            console.debug(
              `Deleted ${chunkKeysToDelete.length} chunks by removing ${baseKeysToDelete.length} items to enforce maxTotalChunks.`
            );
          }
        } else if (this.debug) {
          console.debug(
            `Total chunks (${totalChunks}) within maxTotalChunks (${this.maxTotalChunks}). No excess cleanup needed.`
          );
        }
      }

      await transaction.done;

      if (this.debug) {
        const totalDeleted = itemsDeleted.reduce(
          (acc, curr) => acc + (curr || 0),
          0
        );
        if (totalDeleted > 0) {
          console.debug("Flushed old cache items with different cacheBuster.");
        }
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError("Failed to clean up the cache.");
    }
  }

  private async ensureWorkerInitialized() {
    if (this.workerInitializationFailed) {
      throw new WorkerInitializationError(
        "Worker initialization previously failed"
      );
    }

    if (!this.workerReadyPromise) {
      throw new WorkerInitializationError("Worker is not initialized.");
    }
    await this.workerReadyPromise;
  }

  private getPort(): MessagePort | Worker {
    if (!this.port) {
      throw new WorkerInitializationError("Worker port is not initialized.");
    }
    return this.port;
  }

  /**
   * Retrieves and decrypts an item from the cache.
   * @param key - The key associated with the item.
   * @returns The decrypted string if found and valid, otherwise null.
   * @throws {DecryptionError} If decryption fails.
   * @throws {DatabaseError} If there is an issue accessing the database.
   * @throws {WorkerInitializationError} If the worker is not initialized properly.
   */
  public async getItem(itemKey: string): Promise<string | null> {
    if (this.workerInitializationFailed) {
      return null;
    }

    try {
      const startTime = Date.now();

      if (!this.dbReadyPromise) return null;
      await this.ensureWorkerInitialized();

      if (this.priority === "low") {
        await waitForAnimationFrame();
      }
      const db = await this.dbReadyPromise;
      const baseKey = await deterministicUUID(`${this.cacheKey}:${itemKey}`);
      const now = Date.now();

      const chunkKeys = await getAllChunkKeysForBaseKey(
        db,
        this.storeName,
        baseKey
      );

      if (this.debug) {
        if (chunkKeys.length === 0) {
          console.debug(`Cache miss for key ${itemKey}`);
        } else {
          console.debug(`Cache hit for key ${itemKey}`);
        }
      }

      if (chunkKeys.length === 0) return null;

      const chunks: { index: number; data: EncryptedChunk }[] = [];

      let maxIndex = -1;
      let lastChunkFound = false;

      for (const chunkKey of chunkKeys) {
        const encryptedData = await db.get(this.storeName, chunkKey);
        if (!encryptedData) continue;
        if (encryptedData.timestamp <= now) {
          await this.removeItem(itemKey);
          return null;
        }
        if (encryptedData.cacheBuster !== this.cacheBuster) {
          continue;
        }
        const chunkIndex = parseChunkIndexFromKey(chunkKey);
        if (chunkIndex > maxIndex) {
          maxIndex = chunkIndex;
        }

        const isLastChunk = encryptedData.isLastChunk ?? false;
        if (isLastChunk) {
          lastChunkFound = true;
        }

        chunks.push({
          index: chunkIndex,
          data: encryptedData,
        });
      }

      if (chunks.length === 0) return null;

      // Integrity check: Ensure that the last chunk is present and all preceding chunks are present
      if (!lastChunkFound) {
        throw new IDBCacheError(
          `Integrity check failed for key ${itemKey}: Last chunk is missing.`
        );
      }

      // Ensure all chunk indices from 0 to maxIndex are present
      if (chunks.length !== maxIndex + 1) {
        throw new IDBCacheError(
          `Integrity check failed for key ${itemKey}: Expected ${
            maxIndex + 1
          } chunks, but found ${chunks.length}.`
        );
      }

      const indexSet = new Set(chunks.map((chunk) => chunk.index));
      for (let i = 0; i <= maxIndex; i++) {
        if (!indexSet.has(i)) {
          throw new IDBCacheError(
            `Integrity check failed for key ${itemKey}: Missing chunk at index ${i}.`
          );
        }
      }

      chunks.sort((a, b) => a.index - b.index);

      const port = this.getPort();
      const decryptedChunks = await Promise.all(
        chunks.map(({ data: { iv, ciphertext } }) =>
          decryptChunk(port, iv, ciphertext, this.pendingRequests)
        )
      );

      const duration = Date.now() - startTime;
      if (this.debug && duration > DURATION_THRESHOLD) {
        console.debug(
          `getItem for key ${itemKey} took ${duration}ms for ${
            new TextEncoder().encode(decryptedChunks.join("")).length
          } bytes`
        );
      }

      return decryptedChunks.join("");
    } catch (error) {
      if (error instanceof IDBCacheError) {
        console.error(`Integrity check failed for key ${itemKey}:`, error);
        throw error;
      }
      if (error instanceof DecryptionError) {
        console.error(`Decryption failed for key ${itemKey}:`, error);
        throw error;
      }
      if (error instanceof DatabaseError) {
        console.error(`Database error while getting key ${itemKey}:`, error);
        throw error;
      }
      if (error instanceof WorkerInitializationError) {
        console.error(
          `Worker initialization error while getting key ${itemKey}:`,
          error
        );
        throw error;
      }
      if (error instanceof IDBCacheError) {
        console.error(`IDBCache error while getting key ${itemKey}:`, error);
        throw error;
      }
      console.error(`Unexpected error while getting key ${itemKey}:`, error);
      throw new IDBCacheError("An unexpected error occurred.");
    }
  }

  /**
   * Encrypts and stores an item in the cache.
   * @param key - The key to associate with the value.
   * @param value - The plaintext string to encrypt and store.
   * @throws {WorkerInitializationError} If the worker is not initialized properly.
   * @throws {DatabaseError} If there is an issue accessing the database.
   * @throws {EncryptionError} If encryption fails.
   */
  public async setItem(itemKey: string, value: string): Promise<void> {
    if (this.workerInitializationFailed) {
      return;
    }

    try {
      const startTime = Date.now();

      if (!this.dbReadyPromise) return;
      await this.ensureWorkerInitialized();

      // Check if the new item's chunks would exceed maxTotalChunks config
      if (this.maxTotalChunks !== undefined) {
        const newItemChunks = Math.ceil(value.length / this.chunkSize);
        if (newItemChunks > this.maxTotalChunks) {
          throw new IDBCacheError(
            `Cannot store item: chunks needed (${newItemChunks}) exceeds maxTotalChunks (${this.maxTotalChunks})`
          );
        }
      }

      if (this.priority === "low") {
        await waitForAnimationFrame();
      }
      const db = await this.dbReadyPromise;
      const baseKey = await deterministicUUID(`${this.cacheKey}:${itemKey}`);
      const expirationTimestamp = Date.now() + this.maxAge;

      if (this.priority === "low") {
        await waitForAnimationFrame();
      }
      const existingChunkKeys = await getAllChunkKeysForBaseKey(
        db,
        this.storeName,
        baseKey
      );
      const existingChunkKeysSet = new Set(existingChunkKeys);

      const newChunkKeys = new Set<string>();

      const chunksToAdd: Array<{
        chunkKey: string;
        encryptedChunk: EncryptedChunk;
      }> = [];
      const chunksToUpdate: Array<EncryptedChunk> = [];

      const totalChunks = Math.ceil(value.length / this.chunkSize);

      for (let i = 0; i < value.length; i += this.chunkSize) {
        const chunk = value.slice(i, i + this.chunkSize);
        const chunkIndex = Math.floor(i / this.chunkSize);

        if (this.priority === "low") {
          await waitForAnimationFrame();
        }
        const chunkHash = await deterministicUUID(
          `${this.cacheKey}:${this.cacheBuster}:${chunk}`,
          this.priority
        );
        const chunkKey = generateChunkKey(baseKey, chunkIndex, chunkHash);
        newChunkKeys.add(chunkKey);

        const isLastChunk = chunkIndex === totalChunks - 1;

        if (existingChunkKeysSet.has(chunkKey)) {
          const existingChunk = await db.get(this.storeName, chunkKey);
          if (existingChunk) {
            chunksToUpdate.push({
              ...existingChunk,
              timestamp: expirationTimestamp,
              cacheBuster: this.cacheBuster,
              isLastChunk, // Update the flag in case it's the last chunk
            });
          }
        } else {
          if (this.priority === "low") {
            await waitForAnimationFrame();
          }
          const encryptedChunk = await encryptChunk(
            this.getPort(),
            chunk,
            this.pendingRequests
          );
          chunksToAdd.push({
            chunkKey,
            encryptedChunk: {
              ...encryptedChunk,
              cacheBuster: this.cacheBuster,
              isLastChunk,
            },
          });
        }
      }

      const chunksToDelete = existingChunkKeys.filter((existingKey) => {
        return !newChunkKeys.has(existingKey);
      });

      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.store;

      const operationPromises: Promise<unknown>[] = [];

      for (const chunk of chunksToUpdate) {
        operationPromises.push(store.put(chunk));
      }

      for (const { chunkKey, encryptedChunk } of chunksToAdd) {
        operationPromises.push(
          store.put({
            ...encryptedChunk,
            key: chunkKey,
            timestamp: expirationTimestamp,
          })
        );
      }

      for (const chunkKey of chunksToDelete) {
        operationPromises.push(store.delete(chunkKey));
      }

      await Promise.all(operationPromises);
      if (this.priority === "low") {
        await waitForAnimationFrame();
      }
      await tx.done;

      const duration = Date.now() - startTime;
      if (this.debug && duration > DURATION_THRESHOLD) {
        console.debug(`setItem for key ${itemKey} took ${duration}ms`);
      }
    } catch (error) {
      if (error instanceof WorkerInitializationError) {
        console.error("Worker initialization error in setItem:", error);
        throw error;
      }
      if (error instanceof DatabaseError) {
        console.error("Database error in setItem:", error);
        throw error;
      }
      if (error instanceof EncryptionError) {
        console.error("Encryption error in setItem:", error);
        throw error;
      }
      if (error instanceof IDBCacheError) {
        console.error("IDBCache error in setItem:", error);
        throw error;
      }
      console.error("Unexpected error in setItem:", error);
      throw new IDBCacheError("An unexpected error occurred during setItem.");
    }
  }

  /**
   * Removes an item and all its associated chunks from the cache.
   * @param key - The key associated with the item to remove.
   * @throws {DatabaseError} If there is an issue accessing the database.
   */
  public async removeItem(itemKey: string): Promise<void> {
    if (this.workerInitializationFailed) {
      return;
    }

    try {
      const db = await this.dbReadyPromise;
      const baseKey = await deterministicUUID(`${this.cacheKey}:${itemKey}`);

      const chunkKeys = await getAllChunkKeysForBaseKey(
        db,
        this.storeName,
        baseKey
      );

      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.store;

      const deletePromises: Promise<void>[] = chunkKeys.map((chunkKey) =>
        store.delete(chunkKey)
      );

      await Promise.all(deletePromises);

      await tx.done;
    } catch (error) {
      console.error("Error in removeItem:", error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      if (error instanceof IDBCacheError) {
        throw error;
      }
      throw new DatabaseError("Failed to remove item from the cache.");
    }
  }

  /**
   * Counts the total number of encrypted chunks stored in the cache.
   * @returns The total number of entries (chunks) in the cache.
   * @throws {DatabaseError} If there is an issue accessing the database.
   */
  public async count(): Promise<number> {
    if (this.workerInitializationFailed) {
      return 0;
    }

    try {
      const db = await this.dbReadyPromise;
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.store;

      const totalCount = await store.count();

      await transaction.done;

      if (this.debug) {
        console.debug(`Total entries in cache: ${totalCount}`);
      }

      return totalCount;
    } catch (error) {
      console.error("Error in count():", error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError("Failed to count items in the cache.");
    }
  }

  /**
   * Clears all items from the cache without affecting the worker or pending requests.
   * @throws {DatabaseError} If there is an issue accessing the database.
   */
  public async clear(): Promise<void> {
    if (this.workerInitializationFailed) {
      return;
    }

    try {
      const db = await this.dbReadyPromise;
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.store;

      await store.clear();

      await transaction.done;

      if (this.debug) {
        console.debug("All items have been cleared from the cache.");
      }
    } catch (error) {
      console.error("Error in clear:", error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      if (error instanceof IDBCacheError) {
        throw error;
      }
      throw new DatabaseError("Failed to clear the cache.");
    }
  }

  /**
   * Destroys the IDBCache instance by clearing data (optional), releasing resources, and terminating the SharedWorker.
   * @param options - Configuration options for destruction.
   * @param options.clearData - Whether to clear all cached data before destruction.
   * @throws {DatabaseError} If there is an issue accessing the database during data clearing.
   */
  public async destroy(options?: { clearData?: boolean }): Promise<void> {
    const { clearData = false } = options || {};

    try {
      if (clearData) {
        await this.clear();
      }

      if (this.cleanupIntervalId !== undefined) {
        clearInterval(this.cleanupIntervalId);
      }

      this.pendingRequests.forEach((pending, requestId) => {
        pending.reject(
          new IDBCacheError("IDBCache instance is being destroyed.")
        );
        this.pendingRequests.delete(requestId);
      });

      if (this.port) {
        this.port = null;
      }

      if (this.worker) {
        if (
          typeof SharedWorker !== "undefined" &&
          this.worker instanceof SharedWorker
        ) {
          this.worker.port.close();
        } else if (this.worker instanceof Worker) {
          this.worker.terminate();
        }
        this.worker = null;
      }

      this.workerReadyPromise = null;

      if (this.debug) {
        console.debug("IDBCache instance has been destroyed.");
      }
    } catch (error) {
      console.error("Error in destroy:", error);
      if (error instanceof IDBCacheError) {
        throw error;
      }
      throw new IDBCacheError("Failed to destroy the cache instance.");
    }
  }
}
