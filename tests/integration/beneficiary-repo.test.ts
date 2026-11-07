// @vitest-environment node
/**
 * Slice 3.10: encrypted PayPal recipient at rest (spec §9, §13,
 * ADR-0008). Inserts via the repository port, reads the raw row back,
 * and proves only ciphertext is stored; decrypt recovers the input.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function loadEnvFile(): void {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}
loadEnvFile();

const { prisma } = await import("@/infrastructure/db/prisma");
const { PrismaBeneficiaryRepository } = await import("@/infrastructure/db/repositories");
const { decryptField, encryptField } = await import("@/lib/security/encryption");

const KEY = "c".repeat(64);
const EMAIL = "cipher-test@example.com";
const PLAINTEXT = "cipher.test.paypal@example.com";
let createdId = "";

const orgId = "seed-org-cfsp";

beforeAll(async () => {
  const repo = new PrismaBeneficiaryRepository();
  const record = await repo.create({
    organizationId: orgId,
    displayName: "Cipher Test",
    invitationEmail: EMAIL,
    encryptedPayPalRecipient: encryptField(PLAINTEXT, KEY),
    preferredLanguage: "en",
  });
  createdId = record.id;
});

afterAll(async () => {
  await prisma.beneficiary.deleteMany({ where: { id: createdId } });
  await prisma.$disconnect();
});

describe("encrypted PayPal recipient (Slice 3.10)", () => {
  it("stores only ciphertext — never the plaintext email", async () => {
    const row = await prisma.beneficiary.findUnique({ where: { id: createdId } });
    expect(row!.encryptedPayPalRecipient).not.toContain(PLAINTEXT);
    expect(row!.encryptedPayPalRecipient).not.toContain("@");
  });

  it("decrypts back to the original recipient", async () => {
    const row = await prisma.beneficiary.findUnique({ where: { id: createdId } });
    expect(decryptField(row!.encryptedPayPalRecipient, KEY)).toBe(PLAINTEXT);
  });
});
