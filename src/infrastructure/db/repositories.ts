import "server-only";
import type {
  BeneficiaryInput,
  BeneficiaryRecord,
  BeneficiaryRepository,
  DisbursementInput,
  DisbursementRecord,
  DisbursementRepository,
  LedgerEventInput,
  LedgerEventRecord,
  LedgerEventRepository,
  OrganizationInput,
  OrganizationRecord,
  OrganizationRepository,
  PlanItemInput,
  PlanItemRecord,
  PlanVersionInput,
  PlanVersionRecord,
  PlanVersionRepository,
  RecipientInvitationInput,
  RecipientInvitationRecord,
  RecipientInvitationRepository,
  UserInput,
  UserRecord,
  UserRepository,
} from "@/application/ports/db";
import { prisma } from "@/infrastructure/db/prisma";
import {
  beneficiaryInputSchema,
  disbursementInputSchema,
  ledgerEventInputSchema,
  organizationInputSchema,
  planItemInputSchema,
  planVersionInputSchema,
  recipientInvitationInputSchema,
  userInputSchema,
} from "@/infrastructure/db/schemas";

/**
 * Prisma adapters implementing the repository ports (ADR-0016/0017).
 * External inputs are Zod-validated here; domain DTOs use BigInt minor
 * units and carry no Prisma types past this layer.
 */
export class PrismaOrganizationRepository implements OrganizationRepository {
  async create(input: OrganizationInput): Promise<OrganizationRecord> {
    const data = organizationInputSchema.parse(input);
    return prisma.organization.create({ data });
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    return prisma.organization.findUnique({ where: { id } });
  }
}

export class PrismaUserRepository implements UserRepository {
  async create(input: UserInput): Promise<UserRecord> {
    const data = userInputSchema.parse(input);
    return prisma.user.create({ data });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id } });
  }
}

export class PrismaBeneficiaryRepository implements BeneficiaryRepository {
  async create(input: BeneficiaryInput): Promise<BeneficiaryRecord> {
    const data = beneficiaryInputSchema.parse(input);
    return prisma.beneficiary.create({ data });
  }

  async findById(id: string): Promise<BeneficiaryRecord | null> {
    return prisma.beneficiary.findUnique({ where: { id } });
  }
}

export class PrismaDisbursementRepository implements DisbursementRepository {
  async create(input: DisbursementInput): Promise<DisbursementRecord> {
    const data = disbursementInputSchema.parse(input);
    return prisma.disbursement.create({ data });
  }

  async findById(id: string): Promise<DisbursementRecord | null> {
    return prisma.disbursement.findUnique({ where: { id } });
  }

  async findByPublicReference(publicReference: string): Promise<DisbursementRecord | null> {
    return prisma.disbursement.findUnique({ where: { publicReference } });
  }
}

/** Immutable plan snapshots: create-only port, no update/delete (spec §9). */
export class PrismaPlanVersionRepository implements PlanVersionRepository {
  async create(input: PlanVersionInput): Promise<PlanVersionRecord> {
    const data = planVersionInputSchema.parse(input);
    return prisma.planVersion.create({ data });
  }

  async createItems(inputs: PlanItemInput[]): Promise<PlanItemRecord[]> {
    const data = inputs.map((input) => planItemInputSchema.parse(input));
    if (data.length === 0) return [];
    await prisma.planItem.createMany({ data });
    return prisma.planItem.findMany({
      where: { planVersionId: data[0]!.planVersionId },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findLatestByDisbursementId(disbursementId: string): Promise<PlanVersionRecord | null> {
    return prisma.planVersion.findFirst({
      where: { disbursementId },
      orderBy: { versionNumber: "desc" },
    });
  }

  async findItemsByVersionId(planVersionId: string): Promise<PlanItemRecord[]> {
    return prisma.planItem.findMany({
      where: { planVersionId },
      orderBy: { sortOrder: "asc" },
    });
  }
}

/** Append-only ledger (spec §9): create-only port. */
export class PrismaLedgerEventRepository implements LedgerEventRepository {
  async create(input: LedgerEventInput): Promise<LedgerEventRecord> {
    const data = ledgerEventInputSchema.parse(input);
    return prisma.ledgerEvent.create({ data });
  }
}

export class PrismaRecipientInvitationRepository implements RecipientInvitationRepository {
  async create(input: RecipientInvitationInput): Promise<RecipientInvitationRecord> {
    const data = recipientInvitationInputSchema.parse(input);
    return prisma.recipientInvitation.create({ data });
  }

  async findByTokenHash(tokenHash: string): Promise<RecipientInvitationRecord | null> {
    return prisma.recipientInvitation.findUnique({ where: { tokenHash } });
  }

  async markViewed(id: string, viewedAt: Date): Promise<void> {
    await prisma.recipientInvitation.update({
      where: { id },
      data: { lastViewedAt: viewedAt },
    });
  }
}
