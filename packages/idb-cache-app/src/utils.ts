export function deterministicHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36); // Base-36 string for compact representation
}

/**
 * Generates a simple UUID (version 4) without using external libraries.
 * This function creates a UUID in the format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx,
 * where 'y' is one of [8, 9, A, B].
 *
 * @returns A UUID string.
 */
export function uuid(): string {
  // Helper function to generate a random hexadecimal digit
  const randomHex = (c: string): string => {
    const r: number = (Math.random() * 16) | 0;
    const v: number = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  };

  // Generate the UUID using the helper function
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, randomHex);
}
