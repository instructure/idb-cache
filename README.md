# idb-cache

IndexedDB-based caching library with encryption and chunked storage, designed for performance and security. Implements AsyncStorage interface.

```typescript
interface AsyncStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}
```

## Why encrypt data in IndexedDB?

Encryption keeps data in IndexedDB private, even when a browser profile is shared on the same device. Only one with access to the `cacheKey` can decrypt the data.

## Installation

```bash
npm install @instructure/idb-cache
```

## Usage

```typescript
import { IDBCache } from '@instructure/idb-cache';

// Initialize the cache
const cache = new IDBCache({
  cacheKey: 'your-secure-key',
  cacheBuster: 'unique-cache-buster', // Doubles as salt
  // dbName?: string;
  // chunkSize?: number;
  // cleanupInterval?: number;
  // pbkdf2Iterations?: number;
  // gcTime?: number;
  // debug?: boolean,
});

// Store an item
await cache.setItem('key', 'value');

// Retrieve an item
const token = await cache.getItem('key');
console.log(token); // Outputs: 'value'

// Remove an item
await cache.removeItem('key');

// Clears all items from cache
cache.clear();

// Destroy the cache instance
cache.destroy();
```

## Features

- **Web Worker**: Offloads encryption and decryption tasks to prevent blocking the main thread.
- **Chunking**: Efficiently handles large data by splitting it into chunks.
- **Encryption**: Secures data using AES-GCM with PBKDF2 key derivation.
- **Garbage collection**: Expires and cleans up outdated cache entries.
- **Task processing**: Uses parallelism and queue to mitigate crypto/CPU overload.

## Usage with TanStack Query

Integrate idb-cache as an AsyncStorage persister for TanStack Query.

```typescript
import { QueryClient } from '@tanstack/query-core';
import { experimental_createPersister } from '@tanstack/query-persist-client-core';
import { IDBCache } from 'idb-cache';

const cacheBuster = 'my_salt'; // Doubles as salt for encryption

const idbCache = new IDBCache({
  cacheKey: 'user_cache_key',
  cacheBuster,
});

// Create the persister
const persister = experimental_createPersister({
  storage: idbCache,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: cacheBuster,
});

// Initialize the QueryClient with the persister
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60, // 1 hour
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      persister,
    },
  },
});
```
