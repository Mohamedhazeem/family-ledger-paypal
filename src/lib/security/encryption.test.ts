/**
 * Slice 2.6: PayPal recipient encryption (ADR-0008) — AES-256-GCM with
 * APP_ENCRYPTION_KEY. Tests run in Node (node:crypto).
 */
import { describe, expect, it } from "vitest";
import { decryptField, encryptField } from "./encryption";

const KEY = "a".repeat(64); // 32 bytes hex

describe("encryptField/decryptField", () => {
  it("round-trips the plaintext", () => {
    const ciphertext = encryptField("beneficiary@example.com", KEY);
    expect(decryptField(ciphertext, KEY)).toBe("beneficiary@example.com");
  });

  it("does not store the plaintext", () => {
    const ciphertext = encryptField("beneficiary@example.com", KEY);
    expect(ciphertext).not.toContain("beneficiary@example.com");
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const a = encryptField("beneficiary@example.com", KEY);
    const b = encryptField("beneficiary@example.com", KEY);
    expect(a).not.toBe(b);
  });

  it("rejects a key that is not 32 bytes of hex", () => {
    expect(() => encryptField("x@example.com", "short")).toThrow(/APP_ENCRYPTION_KEY/);
  });
});
