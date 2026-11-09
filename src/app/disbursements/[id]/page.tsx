import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Link2, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { prisma } from "@/infrastructure/db/prisma";
import { getSession } from "@/lib/auth/session";
import { formatMinor } from "@/domain/value-objects/money";
import { friendlyBatchStatus } from "@/domain/payout-status";
import { diffPlans } from "@/domain/plan-diff";
import { visibleTimeline } from "@/domain/timeline";
import { formatStatusLabel, toneForStatus } from "@/app/dashboard/disbursement-formatting";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AcknowledgeButton } from "@/components/disbursements/acknowledge-button";
import { RefreshPayoutStatusButton } from "@/components/disbursements/refresh-payout-status-button";
import { CreateInvitationButton } from "@/components/disbursements/create-invitation-button";
import { PlanResponseWatcher } from "@/components/disbursements/plan-response-watcher";
import { RevokeInvitationButton } from "@/components/disbursements/revoke-invitation-button";
import { SendPaymentButton } from "@/components/disbursements/send-payment-button";
import { DiffCard, TimelineCard, VersionsGrid } from "./detail-sections";

/**
 * GET /disbursements/[id] (Slice 3.7, spec §6 Step 7, §14E):
 * full amount, side-by-side latest plans, version history,
 * deterministic diff + AI explanation, PayPal references, and the
 * explicit (acknowledgement-independent) send-payment action.
 * Responsive: single column on mobile, two columns on tablet,
 * three columns with a sticky action rail on large screens.
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
  if (!disbursement || disbursement.coordinatorId !== session.user.id) {
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
          { items: previous.items.map((item) => ({ category: item.category, amountMinor: item.amountMinor })) },
          { items: latest.items.map((item) => ({ category: item.category, amountMinor: item.amountMinor })) },
        )
      : null;

  const invitations = await prisma.recipientInvitation.findMany({
    where: { disbursementId: id },
    orderBy: { createdAt: "desc" },
  });
  const ledgerEvents = await prisma.ledgerEvent.findMany({
    where: { disbursementId: id },
    orderBy: { createdAt: "asc" },
  });
  const timeline = visibleTimeline(ledgerEvents, "coordinator");

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Link href="/disbursements" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
          <ArrowLeft className="h-4 w-4" /> Back to disbursements
        </Link>

        <section className="mt-4 overflow-hidden rounded-3xl bg-slate-950 text-white">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneForStatus(disbursement.planStatus)}>{formatStatusLabel(disbursement.planStatus)}</Badge>
              <Badge tone={toneForStatus(disbursement.paymentStatus)}>{formatStatusLabel(disbursement.paymentStatus)}</Badge>
              {disbursement.paymentMode === "MOCK" ? <Badge tone="warning">MOCK PAYMENT</Badge> : null}
            </div>
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <h1 className="break-all font-mono text-2xl font-bold tracking-tight sm:text-3xl">
                  {disbursement.publicReference}
                </h1>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" /> {disbursement.beneficiary.displayName}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {disbursement.createdAt.toLocaleDateString()}</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-5 text-left lg:text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Full payment amount</p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
                  ${formatMinor(disbursement.amountMinor)} <span className="text-lg text-slate-400">{disbursement.currency}</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">One unrestricted payout — never split by category</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payment status" description="Batch and item statuses are tracked separately. Batch SUCCESS never implies item delivery." />
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">PayPal batch</p>
                  <p className="mt-2"><Badge tone="info">{friendlyBatchStatus(disbursement.paypalBatchStatus)}</Badge></p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">PayPal item</p>
                  <p className="mt-2"><Badge tone="info">{friendlyBatchStatus(disbursement.paypalItemStatus)}</Badge></p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <RefreshPayoutStatusButton disbursementId={disbursement.id} />
                <p className="text-xs text-slate-500">Explicit refresh only — no auto-polling.</p>
              </div>
            </CardContent>
          </Card>

          <VersionsGrid versions={versions} />

          {diff && previous && latest ? (
            <DiffCard previousNumber={previous.versionNumber} latestNumber={latest.versionNumber} diff={diff} />
          ) : null}

          <TimelineCard timeline={timeline} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 sm:px-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <Wallet className="h-4 w-4" /> Coordinator actions
              </p>
              <p className="mt-1 text-xs text-indigo-100">Acknowledge is never a release condition for payment.</p>
            </div>
            <CardContent className="space-y-6 pt-5">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Acknowledge plan</p>
                <AcknowledgeButton
                  disbursementId={disbursement.id}
                  alreadyAcknowledged={disbursement.planStatus === "COORDINATOR_ACKNOWLEDGED"}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Send payment</p>
                <SendPaymentButton disbursementId={disbursement.id} />
              </div>
              <p className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                One full sandbox payout with an explicit confirmation. Beneficiary consent never gates payment.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Invitations" description="Secure, expiring, revocable links." />
            <CardContent className="space-y-3">
              <PlanResponseWatcher disbursementId={disbursement.id} />
              <CreateInvitationButton disbursementId={disbursement.id} />
              {invitations.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No invitations yet.</p>
              ) : (
                <ul className="space-y-3">
                  {invitations.map((invitation) => {
                    // eslint-disable-next-line react-hooks/purity -- server render, evaluated once per request
                    const expired = invitation.expiresAt.getTime() <= Date.now();
                    const status = invitation.revokedAt ? "Revoked" : expired ? "Expired" : "Active";
                    // Link status ≠ plan decision: acceptance lives in planStatus, not on the invitation.
                    const beneficiaryAccepted =
                      disbursement.planStatus === "BENEFICIARY_ACCEPTED" || disbursement.planStatus === "COORDINATOR_ACKNOWLEDGED";
                    const label = status === "Active" && beneficiaryAccepted ? "Active · Accepted" : status;
                    return (
                      <li key={invitation.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                            <Link2 className="h-4 w-4 text-slate-400" />
                            Invitation ·{" "}
                            <span className={`font-semibold ${status === "Active" ? "text-emerald-700" : status === "Revoked" ? "text-rose-600" : "text-amber-600"}`}>
                              {label}
                            </span>
                          </span>
                          {status === "Active" ? (
                            <RevokeInvitationButton disbursementId={disbursement.id} invitationId={invitation.id} />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Expires {invitation.expiresAt.toLocaleDateString()}
                          {invitation.lastViewedAt ? (
                            <> · Viewed {invitation.lastViewedAt.toLocaleDateString()}</>
                          ) : null}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
