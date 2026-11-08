import "server-only";
import { authPort } from "@/infrastructure/auth/auth-port";

export async function getSession() {
  return authPort.getSession();
}

export async function requireSession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}
