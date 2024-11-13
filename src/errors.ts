export class IDBCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IDBCacheError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DatabaseError extends IDBCacheError {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class CryptoError extends IDBCacheError {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export class WorkerInitializationError extends IDBCacheError {
  constructor(message: string) {
    super(message);
    this.name = "WorkerInitializationError";
  }
}

export class EncryptionError extends IDBCacheError {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

export class DecryptionError extends IDBCacheError {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

export class TimeoutError extends IDBCacheError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class InvalidArgumentError extends IDBCacheError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidArgumentError";
  }
}
