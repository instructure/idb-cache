import randomSeed from "random-seed";

export function deterministicHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36); // Base-36 string for compact representation
}

function calculateByteSize(str: string): number {
  return new TextEncoder().encode(str).length;
}

const textCache: Record<string, string> = {};

export function generateTextOfSize(
  targetSizeInBytes: number,
  seed = "default"
): string {
  const cacheKey = `${targetSizeInBytes}-${seed}`;
  if (textCache[cacheKey]) {
    return textCache[cacheKey];
  }

  const rand = randomSeed.create(seed);
  const estimatedChars = Math.ceil(targetSizeInBytes);
  const charArray = new Array(estimatedChars);

  for (let i = 0; i < estimatedChars; i++) {
    charArray[i] = String.fromCharCode(33 + Math.floor(rand.random() * 94)); // Printable ASCII
  }

  let result = charArray.join("");

  // Ensure the generated result matches the exact target size
  while (calculateByteSize(result) > targetSizeInBytes) {
    result = result.slice(0, -1);
  }

  textCache[cacheKey] = result;
  return result;
}
