import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/infrastructure/db/prisma";
import { getSession } from "@/lib/auth/session";
import { formatMinor } from "@/domain/value-objects/money";
import { diffPlans } from "@/domain/plan-diff";
import { formatStatusLabel, toneForStatus } from "@/app/dashboard/disbursement-formatting";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AcknowledgeButton } from "@/components/disbursements/acknowledge-button";
import { ExplainDiffButton } from "@/components/disbursements/explain-diff-button";
import { RevokeInvitationButton } from "@/components/disbursements/revoke-invitation-button";
import { SendPaymentButton } from "@/components/disbursements/send-payment-button";

/**
 * GET /disbursements/[id] (Slice 3.7, spec §6 Step 7, §14E):
 * full amount, side-by-side latest plans, version history,
 * deterministic diff + AI explanation, PayPal references, and the
 * explicit (acknowledgement-independent) send-payment action.
 */
export default async function DisbursementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const disbursement = await prisma.disbursement.findUnique({
    where: { id },
    include: { beneficiary: true },
  });
  if (!disbursement || disbursement.coordinatorId !== session!.user.id) {
    notFound();
  }

  const versions = await prisma.planVersion.findMany({
    where: { disbursementId: id },
    orderBy: { versionNumber: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  const latest = versions.length > 0 ? versions[versions.length - 1]! : null;
  const previous = versions.length > 1 ? versions[versions.length - 2]! : null;
  const diff =
    latest && previous
      ? diffPlans(
          {
            items: previous.items.map((item) => ({
              category: item.category,
              amountMinor: item.amountMinor,
            })),
          },
          {
            items: latest.items.map((item) => ({
              category: item.category,
              amountMinor: item.amountMinor,
            })),
          },
        )
      : null;

  const invitations = await prisma.recipientInvitation.findMany({
    where: { disbursementId: id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/disbursements" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          <ArrowLeft className="mr-1 inline h-4 w-4" />
          Back to disbursements
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{disbursement.publicReference}</h1>
          <Badge tone={toneForStatus(disbursement.planStatus)}>
            {formatStatusLabel(disbursement.planStatus)}
          </Badge>
          <Badge tone="neutral">{formatStatusLabel(disbursement.paymentStatus)}</Badge>
        </div>
        <p className="text-sm text-slate-500">Beneficiary: {disbursement.beneficiary.displayName}</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-slate-500">Full payment amount (one unrestricted payout)</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
            ${formatMinor(disbursement.amountMinor)} {disbursement.currency}
          </p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">PayPal batch</dt>
              <dd className="font-medium text-slate-800">{disbursement.paypalBatchStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">PayPal item</dt>
              <dd className="font-medium text-slate-800">{disbursement.paypalItemStatus ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {versions.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[previous, latest].filter(Boolean).map((version) => (
            <Card key={version!.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">Version {version!.versionNumber}</h2>
                  <Badge tone={version!.createdByType === "BENEFICIARY" ? "info" : "neutral"}>
                    {version!.createdByType === "BENEFICIARY" ? "Beneficiary" : "Coordinator"}
                  </Badge>
                </div>
                {version!.explanation ? (
                  <p className="text-sm italic text-slate-600">“{version!.explanation}”</p>
                ) : null}
                {version!.items.length === 0 ? (
                  <p className="text-sm text-slate-500">No categories in this version.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {version!.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between py-2">
                        <span className="text-sm text-slate-700">{item.category}</span>
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          {item.amountMinor === null ? "Flexible" : `$${formatMinor(item.amountMinor)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-slate-500">
                  Allocated ${formatMinor(version!.totalAllocatedMinor)} · Unallocated $
                  {formatMinor(version!.unallocatedMinor)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-5 text-sm text-slate-500">
            No plan versions yet.
          </CardContent>
        </Card>
      )}

      {diff ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <h2 className="text-base font-semibold text-slate-900">
              Changes: Version {previous!.versionNumber} → Version {latest!.versionNumber}
            </h2>
            <ul className="space-y-1 text-sm">
              {diff.added.map((entry) => (
                <li key={`a-${entry.category}`} className="text-emerald-700">
                  + Added {entry.category}
                  {entry.v2AmountMinor === null ? "" : ` (${"$" + formatMinor(entry.v2AmountMinor)})`}
                </li>
              ))}
              {diff.removed.map((entry) => (
                <li key={`r-${entry.category}`} className="text-rose-600">
                  − Removed {entry.category}
                  {entry.v1AmountMinor === null ? "" : ` (${"$" + formatMinor(entry.v1AmountMinor)})`}
                </li>
              ))}
              {diff.changed.map((entry) => (
                <li key={`c-${entry.category}`} className="text-amber-700">
                  ~ {entry.category}: {entry.v1AmountMinor === null ? "—" : `$${formatMinor(entry.v1AmountMinor)}`}
                  {" → "}
                  {entry.v2AmountMinor === null ? "—" : `$${formatMinor(entry.v2AmountMinor)}`}
                  {entry.deltaMinor === null
                    ? ""
                    : ` (${entry.deltaMinor > 0n ? "+" : ""}$${formatMinor(entry.deltaMinor < 0n ? -entry.deltaMinor : entry.deltaMinor)})`}
                </li>
              ))}
              {diff.unchanged.map((entry) => (
                <li key={`u-${entry.category}`} className="text-slate-500">
                  = {entry.category} unchanged
                </li>
              ))}
            </ul>
            <ExplainDiffButton
              diff={JSON.parse(
                JSON.stringify(diff, (_key, value) =>
                  typeof value === "bigint" ? value.toString() : value,
                ),
              )}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-base font-semibold text-slate-900">Invitations</h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-slate-500">No invitations yet.</p>
          ) : (
            <ul className="space-y-2">
              {invitations.map((invitation) => {
                // eslint-disable-next-line react-hooks/purity -- server render, evaluated once per request
                const expired = invitation.expiresAt.getTime() <= Date.now();
                const status = invitation.revokedAt ? "Revoked" : expired ? "Expired" : "Active";
                return (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className="text-sm text-slate-700">
                      Link · expires {invitation.expiresAt.toLocaleDateString()} ·{" "}
                      <span className="font-medium">{status}</span>
                    </span>
                    {status === "Active" ? (
                      <RevokeInvitationButton
                        disbursementId={disbursement.id}
                        invitationId={invitation.id}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-base font-semibold text-slate-900">Actions</h2>
          <AcknowledgeButton disbursementId={disbursement.id} />
          <SendPaymentButton />
        </CardContent>
      </Card>
    </div>
  );
}
