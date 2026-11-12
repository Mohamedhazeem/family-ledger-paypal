import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Field encryption (ADR-0008, AGENTS §8): AES-256-GCM keyed by
 * APP_ENCRYPTION_KEY. Ciphertext format: iv:tag:data (base64).
 * Used to store the PayPal recipient email at rest.
 *
 * This module deliberately has no `server-only` marker so non-Next
 * scripts (e.g. `prisma/seed.ts`) can encrypt with the same scheme.
 * Application code should import from `./encryption`, which keeps the
 * server-only guard.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function keyFromHex(keyHex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("APP_ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptField(plaintext: string, keyHex: string): string {
  const key = keyFromHex(keyHex);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decryptField(ciphertext: string, keyHex: string): string {
  const key = keyFromHex(keyHex);
  const [iv64, tag64, data64] = ciphertext.split(":");
  if (!iv64 || !tag64 || !data64) {
    throw new Error("Invalid ciphertext format.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv64, "base64"));
  decipher.setAuthTag(Buffer.from(tag64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(data64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
