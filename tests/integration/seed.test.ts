// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

function loadEnvFile(): void {
  const envPath = join(process.cwd(), ".env");
  try {
    const content = readFileSync(envPath, "utf8");
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

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Slice 1.4 seed idempotency (spec §16)", () => {
  it("seeded scenario exists with the expected counts and amount", async () => {
    // Scoped to the seed scenario's stable keys: later E2E flows create
    // additional rows in the shared dev DB, so global totals are not a
    // valid assertion of the seed state.
    const orgs = await prisma.organization.count({ where: { id: "seed-org-cfsp" } });
    const users = await prisma.user.count({ where: { email: "alex.morgan@example.com" } });
    const bens = await prisma.beneficiary.count({ where: { id: "seed-beneficiary-maria-santos" } });
    const disbs = await prisma.disbursement.count({ where: { publicReference: "FL-SEED-001" } });
    expect(orgs).toBe(1);
    expect(users).toBe(1);
    expect(bens).toBe(1);
    expect(disbs).toBe(1);

    const d = await prisma.disbursement.findUnique({ where: { publicReference: "FL-SEED-001" } });
    expect(d).not.toBeNull();
    expect(d?.amountMinor).toBe(50000n);
    expect(d?.planStatus).toBe("DRAFT");
    expect(d?.paymentStatus).toBe("NOT_SENT");
    expect(d?.currency).toBe("USD");
  });
});
