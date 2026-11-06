// @vitest-environment node
/**
 * Slice 1.3 integration test: insert + read back via the Prisma client.
 * Uses synthetic data only (spec §16) and cleans up after itself —
 * this is a test, not a manual seed; no rows are left behind.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

function loadEnvFile(): void {
  const envPath = join(process.cwd(), ".env");
  let content: string;
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const { prisma } = await import("@/infrastructure/db/prisma");
const { PrismaOrganizationRepository, PrismaUserRepository, PrismaBeneficiaryRepository, PrismaDisbursementRepository } =
  await import("@/infrastructure/db/repositories");

const suffix = randomUUID().slice(0, 8);
const publicReference = `FL-SLICE13-${suffix}`;
let organizationId: string | null = null;

afterAll(async () => {
  if (organizationId) {
    await prisma.disbursement.deleteMany({ where: { organizationId } });
    await prisma.beneficiary.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
  }
  await prisma.$disconnect();
});

describe("Slice 1.3 schema v1 (spec §9)", () => {
  it("inserts Organization/User/Beneficiary/Disbursement and reads them back via Prisma", async () => {
    const organizations = new PrismaOrganizationRepository();
    const users = new PrismaUserRepository();
    const beneficiaries = new PrismaBeneficiaryRepository();
    const disbursements = new PrismaDisbursementRepository();

    const org = await organizations.create({ name: `Slice 1.3 Synthetic Org ${suffix}` });
    organizationId = org.id;
    expect(org.name).toContain("Slice 1.3");

    const user = await users.create({
      organizationId: org.id,
      name: "Alex Morgan",
      email: `alex-${suffix}@example.test`,
      passwordHash: "synthetic-hash-not-a-real-credential",
      role: "COORDINATOR",
    });
    expect(user.role).toBe("COORDINATOR");

    const beneficiary = await beneficiaries.create({
      organizationId: org.id,
      displayName: "Maria Santos",
      invitationEmail: `maria-${suffix}@example.test`,
      // Synthetic ciphertext placeholder — real AES-256-GCM encryption
      // lands in the encryption slice (ADR-0008); never a real email here.
      encryptedPayPalRecipient: "synthetic-ciphertext",
      preferredLanguage: "en",
    });
    expect(beneficiary.preferredLanguage).toBe("en");

    const created = await disbursements.create({
      publicReference,
      organizationId: org.id,
      coordinatorId: user.id,
      beneficiaryId: beneficiary.id,
      amountMinor: 50000n, // USD 500.00 — BigInt minor units, never float
      currency: "USD",
      supportNote: "Please allocate $300 for rent, $150 for school fees and $50 for food.",
      shareSupportNoteWithBeneficiary: true,
      paymentMode: "SANDBOX",
    });
    expect(created.amountMinor).toBe(50000n);
    expect(typeof created.amountMinor).toBe("bigint");
    expect(created.planStatus).toBe("DRAFT");
    expect(created.paymentStatus).toBe("NOT_SENT");

    // Read back directly through the Prisma client (not only the port).
    const readBack = await prisma.disbursement.findUnique({ where: { publicReference } });
    expect(readBack).not.toBeNull();
    expect(readBack?.amountMinor).toBe(50000n);
    expect(readBack?.organizationId).toBe(org.id);
    expect(readBack?.coordinatorId).toBe(user.id);
    expect(readBack?.beneficiaryId).toBe(beneficiary.id);
    expect(readBack?.supportNote).toContain("rent");
    expect(readBack?.paypalPayoutBatchId).toBeNull();

    const byRef = await disbursements.findByPublicReference(publicReference);
    expect(byRef?.id).toBe(created.id);
  });

  it("enforces unique publicReference", async () => {
    const org = await prisma.organization.findUnique({ where: { id: organizationId! } });
    expect(org).not.toBeNull();
    await expect(
      prisma.disbursement.create({
        data: {
          publicReference,
          organizationId: organizationId!,
          coordinatorId: (await prisma.user.findFirst({ where: { organizationId: organizationId! } }))!.id,
          beneficiaryId: (await prisma.beneficiary.findFirst({ where: { organizationId: organizationId! } }))!.id,
          amountMinor: 100n,
          supportNote: "duplicate reference must fail",
        },
      }),
    ).rejects.toThrow();
  });
});
