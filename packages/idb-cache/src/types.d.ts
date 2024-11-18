import type { DBSchema } from "idb";

export interface IDBCacheSchema extends DBSchema {
  cache: {
    key: string;
    value: {
      cacheBuster: string;
      ciphertext: ArrayBuffer;
      isLastChunk?: boolean;
      iv: ArrayBuffer;
      key: string;
      timestamp: number;
    };
    indexes: {
      byTimestamp: number;
      byCacheBuster: string;
    };
  };
}

export type STORE = "cache";

interface EncryptedChunk {
  key: string;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  timestamp: number;
  cacheBuster: string;
  isLastChunk?: boolean;
}

export type WorkerMessage =
  | {
      type: "initialize";
      payload: {
        cacheKey: string;
        pbkdf2Iterations: number;
        cacheBuster: string;
      };
      requestId: unknown;
    }
  | {
      requestId: string;
      type: "encrypt";
      payload: { value: string };
    }
  | {
      requestId: string;
      type: "decrypt";
      payload: { iv: ArrayBuffer; ciphertext: ArrayBuffer };
    }
  | {
      type: "destroy";
      payload: unknown;
      requestId: unknown;
    };

export type WorkerResponse =
  | { requestId: string; type: "encryptResult"; result: EncryptedChunk }
  | { requestId: string; type: "decryptResult"; result: string }
  | { requestId: string; type: "error"; error: string }
  | { type: "ready" }
  | { type: "initError"; error: string };

export type PendingRequest<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export interface ExtendedPendingRequest<T> extends PendingRequest<T> {
  timer: ReturnType<typeof setTimeout>;
}

export type WorkerResponseType<T extends WorkerMessage["type"]> =
  T extends "encrypt" ? EncryptedChunk : T extends "decrypt" ? string : never;
