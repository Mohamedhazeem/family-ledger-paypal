import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Configure it in the environment (see .env.example).");
}
const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

const ORG_NAME = "Community Family Support Programme";
const COORDINATOR_EMAIL = "alex.morgan@example.com";
const COORDINATOR_PASSWORD = "DemoPass123!";
const BENEFICIARY_DISPLAY = "Maria Santos";
const SUPPORT_NOTE =
  "Please allocate $300 for rent, $150 for school fees and $50 for food.";
const AMOUNT_MINOR = 50000n; // USD 500.00 — BigInt minor units, never float

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { id: "seed-org-cfsp" },
    update: { name: ORG_NAME },
    create: { id: "seed-org-cfsp", name: ORG_NAME },
  });

  const coordinator = await prisma.user.upsert({
    where: { email: COORDINATOR_EMAIL },
    update: {
      name: "Alex Morgan",
      organizationId: organization.id,
      role: "COORDINATOR",
      emailVerified: true,
    },
    create: {
      id: "seed-user-alex-morgan",
      organizationId: organization.id,
      name: "Alex Morgan",
      email: COORDINATOR_EMAIL,
      emailVerified: true,
      role: "COORDINATOR",
    },
  });

  // Better Auth credential account so the coordinator can sign in.
  const hashed = await hashPassword(COORDINATOR_PASSWORD);
  const existingAccount = await prisma.account.findFirst({
    where: { userId: coordinator.id, providerId: "credential" },
  });
  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashed, accountId: coordinator.id },
    });
  } else {
    await prisma.account.create({
      data: {
        id: "seed-account-alex-morgan",
        userId: coordinator.id,
        providerId: "credential",
        accountId: coordinator.id,
        password: hashed,
      },
    });
  }

  const beneficiary = await prisma.beneficiary.upsert({
    where: { id: "seed-beneficiary-maria-santos" },
    update: { displayName: BENEFICIARY_DISPLAY, preferredLanguage: "en" },
    create: {
      id: "seed-beneficiary-maria-santos",
      organizationId: organization.id,
      displayName: BENEFICIARY_DISPLAY,
      invitationEmail: "maria.santos@example.com",
      encryptedPayPalRecipient: "synthetic-ciphertext-placeholder",
      preferredLanguage: "en",
    },
  });

  await prisma.disbursement.upsert({
    where: { publicReference: "FL-SEED-001" },
    update: {
      amountMinor: AMOUNT_MINOR,
      supportNote: SUPPORT_NOTE,
      planStatus: "DRAFT",
      paymentStatus: "NOT_SENT",
    },
    create: {
      publicReference: "FL-SEED-001",
      organizationId: organization.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: AMOUNT_MINOR,
      currency: "USD",
      supportNote: SUPPORT_NOTE,
      shareSupportNoteWithBeneficiary: false,
      planStatus: "DRAFT",
      paymentStatus: "NOT_SENT",
      paymentMode: "SANDBOX",
    },
  });

  console.warn("Seed complete: Community Family Support Programme -> Maria Santos USD 500.00");
  console.warn(`Coordinator login: ${COORDINATOR_EMAIL} / ${COORDINATOR_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
