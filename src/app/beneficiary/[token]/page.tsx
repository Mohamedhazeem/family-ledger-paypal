import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { formatMinor } from "@/domain/value-objects/money";
import { GetInvitationView, InvitationNotFoundError } from "@/application/use-cases/get-invitation-view";
import {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaOrganizationRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { RateLimit } from "@/lib/security/rate-limit";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptPlanButton } from "@/components/beneficiary/accept-plan-button";
import { DeclineToShareButton } from "@/components/beneficiary/decline-to-share-button";
import { SuggestChangesForm } from "@/components/beneficiary/suggest-changes-form";
import { minorToDecimal } from "@/components/disbursements/money-client";

/**
 * GET /beneficiary/[token] (Slice 3.2, spec §14F, §13): public,
 * mobile-first, read-only plan view. Unknown, expired, and revoked
 * tokens are indistinguishable 404s. Rate-limited per IP (ADR-0007).
 */
const lookupLimit = new RateLimit({ max: 60, windowMs: 60_000 });

export default async function BeneficiaryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!lookupLimit.check(ip)) {
    notFound();
  }

  let view;
  try {
    view = await new GetInvitationView(
      new PrismaRecipientInvitationRepository(),
      new PrismaDisbursementRepository(),
      new PrismaBeneficiaryRepository(),
      new PrismaPlanVersionRepository(),
      new PrismaOrganizationRepository(),
      new PrismaLedgerEventRepository(),
    ).execute(token);
  } catch (error) {
    if (error instanceof InvitationNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-indigo-600">{view.programmeName}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          Hello{view.beneficiaryDisplayName ? `, ${view.beneficiaryDisplayName}` : ""} — your support plan
        </h1>
        <p className="text-sm text-slate-600">
          {view.programmeName} has put together a support plan for you, below.
        </p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-slate-500">Total support amount</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
            ${formatMinor(view.amountMinor)} {view.currency}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <h2 className="text-base font-semibold text-slate-900">Proposed plan</h2>
          {view.items.length === 0 ? (
            <p className="text-sm text-slate-600">
              Your coordinator has not added any categories yet. Your full support amount remains
              flexible.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {view.items.map((item, index) => (
                <li key={index} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium text-slate-800">{item.category}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {item.amountMinor === null ? "Flexible" : `$${formatMinor(item.amountMinor)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {view.supportNote ? (
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-base font-semibold text-slate-900">From your coordinator</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{view.supportNote}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          <h2 className="text-base font-semibold text-slate-900">Your choice</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This is a voluntary support plan. It does not restrict how you use money you receive.
            You can choose to share an allocation plan or not — your support payment is not
            conditional on sharing. FamilyLedger never asks for receipts and does not track how
            you spend. If something in this plan does not work for you, tell your coordinator.
          </p>
          <div className="mt-4 space-y-3">
            <AcceptPlanButton token={token} />
            <DeclineToShareButton token={token} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-base font-semibold text-slate-900">Suggest changes</h2>
          <p className="text-sm leading-6 text-slate-600">
            Need different categories or amounts? Update the plan below and send your suggestions —
            your coordinator reviews them with you. Nothing changes until they agree.
          </p>
          <SuggestChangesForm
            token={token}
            totalMinor={Number(view.amountMinor)}
            initialItems={view.items.map((item) => ({
              category: item.category,
              amountText: item.amountMinor === null ? "" : minorToDecimal(Number(item.amountMinor)),
            }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}
