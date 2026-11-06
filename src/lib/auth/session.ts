import "server-only";
import { headers } from "next/headers";
import { auth } from "@/infrastructure/auth/better-auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}
