import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CreateDisbursement } from "@/application/use-cases/create-disbursement";
import {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPlanVersionRepository,
  PrismaUserRepository,
} from "@/infrastructure/db/repositories";
import { requireSession } from "@/lib/auth/session";

/**
 * POST /api/disbursements (Slice 2.6, spec §6 Step 1; extended by 2.7).
 * Thin handler: auth → validate body → CreateDisbursement → present.
 * Coordinator-only (spec §13). The optional plan is persisted as
 * immutable PlanVersion v1 (slice 2.7).
 */
const RequestSchema = z.object({
  beneficiary: z.object({
    displayName: z.string().min(1),
    invitationEmail: z.string().email(),
    payPalRecipientEmail: z.string().email(),
    preferredLanguage: z.enum(["en", "ta", "hi"]),
  }),
  amountText: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  currency: z.literal("USD"),
  supportNote: z.string().min(1),
  shareSupportNoteWithBeneficiary: z.boolean().default(false),
  plan: z
    .object({
      summary: z.string().optional(),
      items: z.array(
        z.object({
          category: z.string().trim().min(1),
          amountText: z.string().regex(/^\d+(?:\.\d{1,2})?$/).nullable(),
          evidenceText: z.string().nullable().optional(),
        }),
      ),
    })
    .optional(),
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
    const disbursement = await new CreateDisbursement(
      new PrismaUserRepository(),
      new PrismaBeneficiaryRepository(),
      new PrismaDisbursementRepository(),
      new PrismaPlanVersionRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({
      coordinatorId: session.user.id,
      beneficiary: parsed.data.beneficiary,
      amountText: parsed.data.amountText,
      currency: parsed.data.currency,
      supportNote: parsed.data.supportNote,
      shareSupportNoteWithBeneficiary: parsed.data.shareSupportNoteWithBeneficiary,
      plan: parsed.data.plan
        ? {
            summary: parsed.data.plan.summary,
            items: parsed.data.plan.items.map((item) => ({
              category: item.category,
              amountText: item.amountText,
              evidenceText: item.evidenceText,
            })),
          }
        : undefined,
    });
    return NextResponse.json(
      { id: disbursement.id, publicReference: disbursement.publicReference },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create disbursement";
    const status = message.startsWith("Allocations exceed") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
