// @vitest-environment node
/**
 * Slice 3.11: invitation revocation (spec §6 Step 4, §9).
 * Revoking sets revokedAt and logs a LedgerEvent; the public portal
 * 404s immediately; a second revocation is idempotent.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
const { RevokeInvitation } = await import("@/application/use-cases/revoke-invitation");
const { GetInvitationView, InvitationNotFoundError } = await import("@/application/use-cases/get-invitation-view");
const {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaOrganizationRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} = await import("@/infrastructure/db/repositories");

const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "Revoke Test Beneficiary",
      invitationEmail: "revoke-test@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  for (let i = 0; i < 2; i++) {
    const disbursement = await prisma.disbursement.create({
      data: {
        publicReference: `FL-REVOKE-${i}-${Date.now().toString(36).toUpperCase()}`,
        organizationId: org.id,
        coordinatorId: coordinator.id,
        beneficiaryId: beneficiary.id,
        amountMinor: 50000n,
        currency: "USD",
        supportNote: "Revoke test note",
        planStatus: "DRAFT",
        paymentStatus: "NOT_SENT",
        paymentMode: "SANDBOX",
      },
    });
    createdDisbursementIds.push(disbursement.id);
  }
});

afterAll(async () => {
  for (const id of createdDisbursementIds) {
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.recipientInvitation.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "revoke-test@example.com" } });
  await prisma.$disconnect();
});

function useCase() {
  return new RevokeInvitation(
    new PrismaRecipientInvitationRepository(),
    new PrismaDisbursementRepository(),
    new PrismaLedgerEventRepository(),
  );
}

function viewUseCase() {
  return new GetInvitationView(
    new PrismaRecipientInvitationRepository(),
    new PrismaDisbursementRepository(),
    new PrismaBeneficiaryRepository(),
    new PrismaPlanVersionRepository(),
    new PrismaOrganizationRepository(),
    new PrismaLedgerEventRepository(),
  );
}

async function coordinatorId(): Promise<string> {
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  return coordinator.id;
}

async function makeInvitation(disbursementId: string): Promise<{ id: string; token: string }> {
  const token = `revoke-token-${Math.random().toString(36).slice(2)}`;
  const invitation = await prisma.recipientInvitation.create({
    data: {
      disbursementId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return { id: invitation.id, token };
}

describe("RevokeInvitation (Slice 3.11)", () => {
  it("revokes an active invitation and logs the event", async () => {
    const id = createdDisbursementIds[0]!;
    const { id: invitationId } = await makeInvitation(id);
    await useCase().execute({ coordinatorId: await coordinatorId(), disbursementId: id, invitationId });

    const row = await prisma.recipientInvitation.findUnique({ where: { id: invitationId } });
    expect(row!.revokedAt).not.toBeNull();

    const event = await prisma.ledgerEvent.findFirst({
      where: { disbursementId: id, eventType: "INVITATION_REVOKED" },
    });
    expect(event).not.toBeNull();
    expect(event!.actorType).toBe("COORDINATOR");
  });

  it("the revoked token is refused by the public view (404 behavior)", async () => {
    const id = createdDisbursementIds[1]!;
    const { id: invitationId, token } = await makeInvitation(id);
    await useCase().execute({ coordinatorId: await coordinatorId(), disbursementId: id, invitationId });
    await expect(viewUseCase().execute(token)).rejects.toBeInstanceOf(InvitationNotFoundError);
  });

  it("a second revocation is idempotent", async () => {
    const id = createdDisbursementIds[1]!;
    const { id: invitationId } = await makeInvitation(id);
    const first = await useCase().execute({ coordinatorId: await coordinatorId(), disbursementId: id, invitationId });
    const second = await useCase().execute({ coordinatorId: await coordinatorId(), disbursementId: id, invitationId });
    expect(second.revokedAt).toEqual(first.revokedAt);
    const events = await prisma.ledgerEvent.count({
      where: { disbursementId: id, eventType: "INVITATION_REVOKED", payloadJson: { contains: invitationId } },
    });
    expect(events).toBe(1);
  });
});
