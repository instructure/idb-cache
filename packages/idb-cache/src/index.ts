import { decryptChunk, encryptChunk } from "./encryption";
import type {
  EncryptedChunk,
  ExtendedPendingRequest,
  IDBCacheSchema,
  STORE,
} from "./types";
import {
  generateChunkKey,
  openDatabase,
  computeChunkHash,
  parseChunkIndexFromKey,
  getAllChunkKeysForBaseKey,
  deterministicUUID,
} from "./utils";
import { encryptionWorkerFunction } from "./workerFunction";
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

const DB_VERSION = 1;
const DEFAULT_CHUNK_SIZE = 25000;
const DEFAULT_GC_TIME = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PBKDF2_ITERATIONS = 100000;
const CLEANUP_INTERVAL = 60 * 1000;

const isSubtleCryptoSupported = crypto?.subtle;

interface IDBCacheConfig {
  cacheBuster: string;
  cacheKey: string;
  chunkSize?: number;
  cleanupInterval?: number;
  dbName?: string;
  debug?: boolean;
  pbkdf2Iterations?: number;
  gcTime?: number;
}

interface AsyncStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<void>;
}

export class IDBCache implements AsyncStorage {
  dbReadyPromise: Promise<import("idb").IDBPDatabase<IDBCacheSchema>>;
  private storeName: STORE;
  private worker: Worker | null = null;
  private port: MessagePort | null = null;
  private pendingRequests: Map<
    string,
    ExtendedPendingRequest<EncryptedChunk | string>
  >;
  private workerReadyPromise: Promise<void> | null = null;
  private gcTime: number;
  private cleanupIntervalId: number | undefined;

  private cacheKey: string;
  private chunkSize: number;
  private cleanupInterval: number;
  private pbkdf2Iterations: number;
  private cacheBuster: string;
  private debug: boolean;

  constructor(config: IDBCacheConfig) {
    const {
      cacheKey,
      cacheBuster,
      debug = false,
      dbName = "idb-cache",
      gcTime = DEFAULT_GC_TIME,
      chunkSize = DEFAULT_CHUNK_SIZE,
      cleanupInterval = CLEANUP_INTERVAL,
      pbkdf2Iterations = DEFAULT_PBKDF2_ITERATIONS,
    } = config;

    this.storeName = "cache";
    this.cacheKey = cacheKey;
    this.debug = debug;
    this.gcTime = gcTime;
    this.chunkSize = chunkSize;
    this.cleanupInterval = cleanupInterval;
    this.pbkdf2Iterations = pbkdf2Iterations;
    this.cacheBuster = cacheBuster;
    this.pendingRequests = new Map();

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

    this.cleanupIntervalId = window.setInterval(
      this.cleanupExpiredItems.bind(this),
      this.cleanupInterval
    );

    this.initWorker(cacheKey, cacheBuster)
      .then(() => {
        this.cleanupExpiredItems().catch((error) =>
          console.error("Initial cleanup failed:", error)
        );
        this.flushBustedCacheItems().catch((error) =>
          console.error("Failed to flush old cache items:", error)
        );
      })
      .catch((error) => {
        console.error("Worker initialization failed:", error);
      });
  }

  /**
   * Initializes the worker by creating it, setting up communication, and handling initialization.
   * @param cacheKey - The cache key used for encryption/decryption.
   * @param cacheBuster - The cacheBuster used as a fixed salt.
   * @throws {WorkerInitializationError} If the worker fails to initialize.
   */
  private async initWorker(
    cacheKey: string,
    cacheBuster: string
  ): Promise<void> {
    if (this.workerReadyPromise) {
      return this.workerReadyPromise;
    }

    this.workerReadyPromise = new Promise<void>((resolve, reject) => {
      const rejectAll = (errorMessage: string) => {
        reject(new WorkerInitializationError(errorMessage));
        rejectAllPendingRequests(this.pendingRequests, errorMessage);
      };

      const { worker, port } = createWorkerFromFunction(
        encryptionWorkerFunction,
        rejectAll
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
      console.error("Worker failed to initialize:", error);
      if (error instanceof IDBCacheError) {
        throw error;
      }
      throw new WorkerInitializationError("Worker failed to initialize.");
    }
  }

  /**
   * Flushes items from the cache that do not match the current cacheBuster.
   * @throws {DatabaseError} If there is an issue accessing the database.
   */
  private async flushBustedCacheItems(): Promise<void> {
    try {
      const db = await this.dbReadyPromise;
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.store;
      const index = store.index("byCacheBuster");

      const currentCacheBuster = this.cacheBuster;

      const lowerBoundRange = IDBKeyRange.upperBound(currentCacheBuster, true);
      const upperBoundRange = IDBKeyRange.lowerBound(currentCacheBuster, true);

      const deleteItemsInRange = async (range: IDBKeyRange) => {
        let cursor = await index.openCursor(range);
        while (cursor) {
          if (this.debug) {
            console.debug(
              "Deleting item with cacheBuster:",
              cursor.value.cacheBuster
            );
          }
          await cursor.delete();
          cursor = await cursor.continue();
        }
      };

      await Promise.all([
        deleteItemsInRange(lowerBoundRange),
        deleteItemsInRange(upperBoundRange),
      ]);

      await transaction.done;
      if (this.debug) {
        console.debug("Flushed old cache items with different cacheBuster.");
      }
    } catch (error) {
      console.error("Error during flushBustedCacheItems:", error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError("Failed to flush old cache items.");
    }
  }

  /**
   * Cleans up expired items from the IndexedDB store based on their timestamps.
   * @throws {DatabaseError} If there is an issue accessing the database.
   */
  private async cleanupExpiredItems() {
    try {
      const db = await this.dbReadyPromise;
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.store;
      const index = store.index("byTimestamp");
      const now = Date.now();

      let cursor = await index.openCursor();

      while (cursor) {
        const { timestamp } = cursor.value;
        if (timestamp <= now) {
          const age = now - timestamp;
          if (this.debug) {
            console.debug(
              `Deleting item with timestamp ${timestamp}. It is ${age}ms older than the expiration.`
            );
          }
          await cursor.delete();
        } else {
          break;
        }
        cursor = await cursor.continue();
      }

      await transaction.done;
    } catch (error) {
      console.error("Error during cleanupExpiredItems:", error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError("Failed to clean up expired items.");
    }
  }

  private async ensureWorkerInitialized() {
    if (!this.workerReadyPromise) {
      throw new WorkerInitializationError("Worker is not initialized.");
    }
    await this.workerReadyPromise;
  }

  private getPort(): MessagePort {
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
  async getItem(itemKey: string): Promise<string | null> {
    try {
      const startTime = Date.now();

      if (!this.dbReadyPromise) return null;
      await this.ensureWorkerInitialized();

      const db = await this.dbReadyPromise;
      const baseKey = await deterministicUUID(this.cacheKey, itemKey);
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
        chunks.push({
          index: chunkIndex,
          data: encryptedData,
        });
      }

      if (chunks.length === 0) return null;

      chunks.sort((a, b) => a.index - b.index);

      const decryptedChunks = await Promise.all(
        chunks.map(({ data: { iv, ciphertext } }) =>
          decryptChunk(this.getPort(), iv, ciphertext, this.pendingRequests)
        )
      );

      const duration = Date.now() - startTime;
      if (this.debug && duration > 200) {
        console.debug(`getItem for key ${itemKey} took ${duration}ms`);
      }

      return decryptedChunks.join("");
    } catch (error) {
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
  async setItem(itemKey: string, value: string): Promise<void> {
    try {
      const startTime = Date.now();

      if (!this.dbReadyPromise) return;
      await this.ensureWorkerInitialized();

      const db = await this.dbReadyPromise;
      const baseKey = await deterministicUUID(this.cacheKey, itemKey);
      const expirationTimestamp = Date.now() + this.gcTime;

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

      for (let i = 0; i < value.length; i += this.chunkSize) {
        const chunk = value.slice(i, i + this.chunkSize);
        const chunkIndex = Math.floor(i / this.chunkSize);

        const chunkHash = await computeChunkHash(chunk);
        const chunkKey = generateChunkKey(baseKey, chunkIndex, chunkHash);
        newChunkKeys.add(chunkKey);

        if (existingChunkKeysSet.has(chunkKey)) {
          const existingChunk = await db.get(this.storeName, chunkKey);
          if (
            existingChunk &&
            existingChunk.timestamp !== expirationTimestamp
          ) {
            chunksToUpdate.push({
              ...existingChunk,
              timestamp: expirationTimestamp,
              cacheBuster: this.cacheBuster,
            });
          }
        } else {
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

      await tx.done;

      const duration = Date.now() - startTime;
      if (this.debug && duration > 200) {
        console.debug(`setItem for key ${itemKey} took ${duration}ms`);
      }
    } catch (error) {
      if (error instanceof WorkerInitializationError) {
        console.error("Worker port is not initialized:", error);
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
  async removeItem(itemKey: string): Promise<void> {
    try {
      const db = await this.dbReadyPromise;
      const baseKey = await deterministicUUID(this.cacheKey, itemKey);

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
   * Destroys the IDBCache instance by clearing intervals, terminating the worker, and rejecting all pending requests.
   */
  public destroy() {
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
      this.port.postMessage({ type: "destroy" });
      this.port.close();
      this.port = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.workerReadyPromise = null;
  }
}
