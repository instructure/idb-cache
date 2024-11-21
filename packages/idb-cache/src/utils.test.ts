import { expect, test, describe } from "vitest";
import { deterministicUUID, generateUUIDFromHash } from "./utils";

const hash1 =
  "ee26b0dd4af7e749aa1a8ee3c10ae9923f618980772e473f8819a5d4940e0db27ac185f8a0e1d5f84f88bc887fd67b143732c304cc5fa9ad8e6f57f50028a8ff";
const hash2 =
  "aa26b0aa4af7a749aa1a1aa3c10aa9923f611910772a473f1119a5a4940a0ab27ac115f1a0a1a5f14f11bc117fa67b143732c304cc5fa9aa1a6f57f50021a1ff";

describe("generateUUIDFromHash", () => {
  test("generates valid UUID v4 format", () => {
    const uuid = generateUUIDFromHash(hash1);

    // Check UUID format (8-4-4-4-12 characters)
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  test("generates consistent UUIDs for same input", () => {
    const uuid1 = generateUUIDFromHash(hash1);
    const uuid2 = generateUUIDFromHash(hash1);

    expect(uuid1).toBe(uuid2);
  });

  test("sets correct version (5) in UUID", () => {
    const uuid = generateUUIDFromHash(hash1);
    expect(uuid.charAt(14)).toBe("5");
  });

  test("sets correct variant bits in UUID", () => {
    const uuid = generateUUIDFromHash(hash1);

    // The 19th character should be 8, 9, a, or b
    expect(uuid.charAt(19)).toMatch(/[89ab]/);
  });

  test("generates different UUIDs for different inputs", () => {
    const uuid1 = generateUUIDFromHash(hash1);
    const uuid2 = generateUUIDFromHash(hash2);

    expect(uuid1).not.toBe(uuid2);
  });

  test("throws error for invalid hash length", () => {
    expect(() => generateUUIDFromHash("123")).toThrowError();
  });

  test("throws error for non-hex characters", () => {
    const invalidHash =
      "qe26b0dd4af7e749aa1a8ee3c10ae9923f618980772e473f8819a5d4940e0db27ac185f8a0e1d5f84f88bc887fd67b143732c304cc5fa9ad8e6f57f50028a8ff"; // Contains non-hex chars

    expect(() => {
      generateUUIDFromHash(invalidHash);
    }).toThrowError();
  });
});

describe("deterministicUUID", () => {
  test("generates consistent UUID for the same key", async () => {
    const key = "test-key";
    const uuid1 = await deterministicUUID(key);
    const uuid2 = await deterministicUUID(key);
    expect(uuid1).toBe(uuid2);
  });

  test("generates different UUIDs for different keys", async () => {
    const uuid1 = await deterministicUUID("test");
    const uuid2 = await deterministicUUID("test2");
    expect(uuid1).not.toBe(uuid2);
  });
});
