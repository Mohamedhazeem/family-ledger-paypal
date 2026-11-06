import "server-only";
import type {
  BeneficiaryInput,
  BeneficiaryRecord,
  BeneficiaryRepository,
  DisbursementInput,
  DisbursementRecord,
  DisbursementRepository,
  OrganizationInput,
  OrganizationRecord,
  OrganizationRepository,
  UserInput,
  UserRecord,
  UserRepository,
} from "@/application/ports/db";
import { prisma } from "@/infrastructure/db/prisma";
import {
  beneficiaryInputSchema,
  disbursementInputSchema,
  organizationInputSchema,
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
