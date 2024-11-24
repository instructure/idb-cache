import {
  type DBSchema,
  type IndexNames,
  type StoreNames,
  deleteDB,
  openDB,
} from "idb";
import type { IDBCacheSchema, STORE } from "./types";
import { LRUCache } from "./LRUCache";

const uuidCache = new LRUCache<string, string>(1000);

// Used to avoid main thread blocking
//   even though it slows operations
export function waitForAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function isValidHex(hex: string): boolean {
  return /^[0-9a-fA-F]{128}$/.test(hex);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hex = "";
  for (const byte of byteArray) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

// version 5
export function generateUUIDFromHash(hashHex: string): string {
  if (!isValidHex(hashHex)) {
    throw new Error("Invalid hash: Must be a 128-character hexadecimal string");
  }

  return [
    hashHex.slice(0, 8),
    hashHex.slice(8, 12),
    `5${hashHex.slice(13, 16)}`,
    ((Number.parseInt(hashHex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) +
      hashHex.slice(17, 20),
    hashHex.slice(20, 32),
  ].join("-");
}

/**
 * Generates a deterministic UUID based on SHA-512 hash.
 * @param cacheKey - The cache key.
 * @param itemKey - The item key.
 * @returns A deterministic UUID string.
 */
export async function deterministicUUID(
  key: string,
  priority = "normal"
): Promise<string> {
  if (uuidCache.has(key)) {
    const uuid = uuidCache.get(key);
    if (typeof uuid === "string") {
      return uuid;
    }
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  if (priority === "low") {
    await waitForAnimationFrame();
  }
  // Usually under 1 ms; not outsourced to worker
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashHex = bufferToHex(hashBuffer);

  const uuid = generateUUIDFromHash(hashHex);
  uuidCache.set(key, uuid);
  return uuid;
}

export function generateChunkKey(
  baseKey: string,
  chunkIndex: number,
  chunkHash: string
): string {
  return `${baseKey}-chunk-${String(chunkIndex).padStart(6, "0")}-${chunkHash}`;
}

export function parseChunkIndexFromKey(chunkKey: string): number {
  const parts = chunkKey.split("-chunk-");
  if (parts.length < 2) return -1;
  const chunkInfo = parts[1];
  const indexPart = chunkInfo.split("-")[0];
  return Number.parseInt(indexPart, 10);
}

export async function getAllChunkKeysForBaseKey(
  db: import("idb").IDBPDatabase<IDBCacheSchema>,
  storeName: STORE,
  baseKey: string
): Promise<string[]> {
  const keys: string[] = [];
  const tx = db.transaction(storeName, "readonly");
  const store = tx.store;

  const lowerBound = `${baseKey}-chunk-000000-`;
  const upperBound = `${baseKey}-chunk-999999\uffff`;

  const keyRange = IDBKeyRange.bound(lowerBound, upperBound, false, false);

  let cursor = await store.openKeyCursor(keyRange);
  while (cursor) {
    keys.push(cursor.key);
    cursor = await cursor.continue();
  }

  await tx.done;
  return keys;
}

function createStoreWithIndexes<T extends DBSchema>(
  db: import("idb").IDBPDatabase<T>,
  storeName: StoreNames<T>
): void {
  if (!db.objectStoreNames.contains(storeName)) {
    const store = db.createObjectStore(storeName, { keyPath: "key" });
    store.createIndex(
      "byTimestamp" as IndexNames<T, StoreNames<T>>,
      "timestamp"
    );
    store.createIndex(
      "byCacheBuster" as IndexNames<T, StoreNames<T>>,
      "cacheBuster"
    );
  }
}

export async function openDatabase<T extends DBSchema>(
  dbName: string,
  storeName: StoreNames<T>,
  dbVersion: number
): Promise<import("idb").IDBPDatabase<T>> {
  try {
    await waitForAnimationFrame();
    return await openDB<T>(dbName, dbVersion, {
      upgrade(db) {
        createStoreWithIndexes(db, storeName);
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "VersionError") {
      console.warn(`VersionError: Deleting database ${dbName} and retrying...`);
      await deleteDB(dbName);
      await waitForAnimationFrame();
      return await openDB<T>(dbName, dbVersion, {
        upgrade(db) {
          createStoreWithIndexes(db, storeName);
        },
      });
    }
    throw error;
  }
}
