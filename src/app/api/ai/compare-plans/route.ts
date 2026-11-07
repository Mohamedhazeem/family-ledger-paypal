import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { PlanDiff } from "@/domain/plan-diff";
import { ExplainPlanDiff } from "@/application/use-cases/explain-plan-diff";
import { createAiProvider } from "@/infrastructure/ai/factory";
import { requireSession } from "@/lib/auth/session";

/**
 * POST /api/ai/compare-plans (Slice 3.6, spec §12B).
 * Coordinator-only. Receives only the deterministic diff; the AI may
 * explain it but never computes it. Unchanged diffs and AI failures
 * return the deterministic template.
 */
const AmountString = z.string().regex(/^\d+$/).nullable();
const DeltaString = z.string().regex(/^-?\d+$/).nullable();

const EntrySchema = z.object({
  category: z.string().min(1),
  v1AmountMinor: AmountString,
  v2AmountMinor: AmountString,
  deltaMinor: DeltaString,
});

const DiffSchema = z.object({
  added: z.array(EntrySchema),
  removed: z.array(EntrySchema),
  changed: z.array(EntrySchema),
  unchanged: z.array(EntrySchema),
});

function toBigInt(value: string | null): bigint | null {
  return value === null ? null : BigInt(value);
}

function toPlanDiff(wire: z.infer<typeof DiffSchema>): PlanDiff {
  const convert = (entries: z.infer<typeof EntrySchema>[]) =>
    entries.map((entry) => ({
      category: entry.category,
      v1AmountMinor: toBigInt(entry.v1AmountMinor),
      v2AmountMinor: toBigInt(entry.v2AmountMinor),
      deltaMinor: toBigInt(entry.deltaMinor),
    }));
  return {
    added: convert(wire.added),
    removed: convert(wire.removed),
    changed: convert(wire.changed),
    unchanged: convert(wire.unchanged),
  };
}

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

  const parsed = DiffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await new ExplainPlanDiff(createAiProvider()).execute(toPlanDiff(parsed.data));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not explain the diff" },
      { status: 502 },
    );
  }
}
