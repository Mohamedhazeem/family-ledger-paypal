import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAiProvider } from "@/infrastructure/ai/factory";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";

/**
 * POST /api/ai/translate (spec §12C). Coordinator-only. Translates
 * display labels/explanations into en/ta/hi; canonical amounts and
 * identifiers are never translated (the adapter prompt forbids it and
 * the output is schema-validated).
 */
const TranslateRequestSchema = z.strictObject({
  text: z.string().min(1).max(2000),
  targetLang: z.enum(["en", "ta", "hi"]),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withSecurityHeaders(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
  }
  const parsed = TranslateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 }),
    );
  }
  try {
    const result = await createAiProvider().translate(parsed.data);
    return withSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error instanceof Error ? error.message : "Could not translate" }, { status: 502 }),
    );
  }
}
