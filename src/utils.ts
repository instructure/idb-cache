import {
  type DBSchema,
  type IndexNames,
  type StoreNames,
  deleteDB,
  openDB,
} from "idb";
import type { IDBCacheSchema, STORE } from "./types";

/**
 * Generates a UUID v1-like string.
 * @returns A UUID v1-like string.
 */
export function generateUUIDv1(): string {
  const now = Date.now();

  const timeLow = (now & 0xffffffff).toString(16).padStart(8, "0");
  const timeMid = ((now / 0x100000000) & 0xffff).toString(16).padStart(4, "0");
  const timeHiAndVersion = (((now / 0x1000000000000) & 0x0fff) | 0x1000)
    .toString(16)
    .padStart(4, "0");

  const clockSeq = (Math.floor(Math.random() * 0x3fff) | 0x8000)
    .toString(16)
    .padStart(4, "0");

  const node = crypto.getRandomValues(new Uint8Array(6));
  const nodeHex = Array.from(node)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeq}-${nodeHex}`;
}

const uuidCache = new Map<string, string>();

/**
 * Generates a deterministic UUID based on SHA-256 hash.
 * @param cacheKey - The cache key.
 * @param itemKey - The item key.
 * @returns A deterministic UUID string.
 */
export async function deterministicUUID(
  cacheKey: string,
  itemKey: string
): Promise<string> {
  const key = `${cacheKey}:${itemKey}`;

  if (uuidCache.has(key)) {
    const uuid = uuidCache.get(key);
    if (typeof uuid === "string") {
      return uuid;
    }
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const uuid = [
    hashHex.slice(0, 8),
    hashHex.slice(8, 12),
    `4${hashHex.slice(13, 16)}`,
    ((Number.parseInt(hashHex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) +
      hashHex.slice(17, 20),
    hashHex.slice(20, 32),
  ].join("-");
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

export async function computeChunkHash(chunk: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(chunk);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
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
    return await openDB<T>(dbName, dbVersion, {
      upgrade(db) {
        createStoreWithIndexes(db, storeName);
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "VersionError") {
      console.warn(`VersionError: Deleting database ${dbName} and retrying...`);
      await deleteDB(dbName);
      return await openDB<T>(dbName, dbVersion, {
        upgrade(db) {
          createStoreWithIndexes(db, storeName);
        },
      });
    }
    throw error;
  }
}
