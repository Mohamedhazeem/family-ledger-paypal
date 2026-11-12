import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { encryptField } from "../src/lib/security/cipher";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env when running locally (Render injects env vars instead).
function loadEnvFile(): void {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (/^".*"$/.test(value)) value = value.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* no .env (e.g. Render) — rely on process.env */
  }
}
loadEnvFile();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Configure it in the environment (see .env.example).`);
  }
  return value;
}

const connectionString = requiredEnv("DATABASE_URL");
const encryptionKey = requiredEnv("APP_ENCRYPTION_KEY");
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
    update: {
      displayName: BENEFICIARY_DISPLAY,
      preferredLanguage: "en",
      // Re-encrypt on every run so a rotated APP_ENCRYPTION_KEY (or the
      // original placeholder row) never leaves an undecryptable recipient.
      encryptedPayPalRecipient: encryptField("maria.santos.paypal@example.com", encryptionKey),
    },
    create: {
      id: "seed-beneficiary-maria-santos",
      organizationId: organization.id,
      displayName: BENEFICIARY_DISPLAY,
      invitationEmail: "maria.santos@example.com",
      encryptedPayPalRecipient: encryptField("maria.santos.paypal@example.com", encryptionKey),
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

  // Demo MOCK-mode row: badge state + an unknown (FOO) raw status to
  // prove unknowns surface verbatim instead of being coerced.
  await prisma.disbursement.upsert({
    where: { publicReference: "FL-SEED-002" },
    update: {
      paymentMode: "MOCK",
      paypalBatchStatus: "FOO",
      paypalItemStatus: "FOO",
    },
    create: {
      id: "seed-disbursement-mock",
      publicReference: "FL-SEED-002",
      organizationId: organization.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: AMOUNT_MINOR,
      currency: "USD",
      supportNote: "Mock-mode demo row (synthetic, no live money).",
      shareSupportNoteWithBeneficiary: false,
      planStatus: "DRAFT",
      paymentStatus: "ON_HOLD",
      paymentMode: "MOCK",
      paypalBatchStatus: "FOO",
      paypalItemStatus: "FOO",
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
