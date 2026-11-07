import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ParseSupportIntent } from "@/application/use-cases/parse-support-intent";
import { createAiProvider } from "@/infrastructure/ai/factory";
import { requireSession } from "@/lib/auth/session";

/**
 * POST /api/ai/parse-intent (Slice 2.5, spec §8, §12).
 * Thin handler: auth → validate body → ParseSupportIntent → present.
 * Coordinator-only (spec §13). No persistence here.
 */
const RequestSchema = z.object({
  note: z.string().min(1),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const plan = await new ParseSupportIntent(createAiProvider()).execute({
      note: parsed.data.note,
      amountMinor: BigInt(parsed.data.amountMinor),
      currency: parsed.data.currency,
    });
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI provider failed" },
      { status: 502 },
    );
  }
}
