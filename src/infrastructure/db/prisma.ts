import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma";

/**
 * Infrastructure adapter: Prisma client singleton (Prisma 7 + pg adapter).
 * DATABASE_URL comes from the environment only (ADR-0015); never hardcoded.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Configure it in the environment (see .env.example).");
  }
  return new PrismaClient({ adapter: new PrismaPg(connectionString) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
