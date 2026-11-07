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
import {
  PORTAL_LANGS,
  localizeView,
  resolvePortalLang,
  type PortalLang,
} from "@/lib/i18n/beneficiary";

/**
 * GET /beneficiary/[token] (Slice 3.2, spec §14F, §13; localized by
 * 3.8): public, mobile-first, read-only plan view. Unknown, expired,
 * and revoked tokens are indistinguishable 404s. Rate-limited per
 * IP (ADR-0007). Canonical amounts/IDs are never translated.
 */
const lookupLimit = new RateLimit({ max: 60, windowMs: 60_000 });

const LANG_LABELS: Record<PortalLang, string> = { en: "English", ta: "தமிழ்", hi: "हिंदी" };

export default async function BeneficiaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
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

  const { lang } = await searchParams;
  const activeLang = resolvePortalLang(view.beneficiaryLanguage, lang);
  const { strings } = localizeView(view, activeLang);

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-10">
      <nav className="flex items-center justify-end gap-1 text-sm" aria-label="Language">
        {PORTAL_LANGS.map((l) => (
          <a
            key={l}
            href={`?lang=${l}`}
            className={`rounded-full px-2.5 py-1 transition ${
              l === activeLang
                ? "bg-indigo-600 font-medium text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {LANG_LABELS[l]}
          </a>
        ))}
      </nav>
      <header className="space-y-2">
        <p className="text-sm font-medium text-indigo-600">{view.programmeName}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {strings.greeting}
          {view.beneficiaryDisplayName ? `, ${view.beneficiaryDisplayName}` : ""} — {strings.yourSupportPlan}
        </h1>
        <p className="text-sm text-slate-600">
          {view.programmeName} {strings.programmeSupportPlan}
        </p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-slate-500">{strings.totalSupportAmount}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
            ${formatMinor(view.amountMinor)} {view.currency}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <h2 className="text-base font-semibold text-slate-900">{strings.proposedPlan}</h2>
          {view.items.length === 0 ? (
            <p className="text-sm text-slate-600">{strings.noCategoriesYet}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {view.items.map((item, index) => (
                <li key={index} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium text-slate-800">{item.category}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {item.amountMinor === null ? strings.flexible : `$${formatMinor(item.amountMinor)}`}
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
            <h2 className="text-base font-semibold text-slate-900">{strings.fromYourCoordinator}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{view.supportNote}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          <h2 className="text-base font-semibold text-slate-900">{strings.yourChoice}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{strings.consentStatement}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{strings.privacyStatement}</p>
          <div className="mt-4 space-y-3">
            <AcceptPlanButton token={token} labels={{ accept: strings.acceptPlan }} />
            <DeclineToShareButton token={token} labels={{ decline: strings.declineToShare }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-base font-semibold text-slate-900">{strings.suggestChanges}</h2>
          <SuggestChangesForm
            token={token}
            totalMinor={Number(view.amountMinor)}
            submitLabel={strings.suggestChanges}
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
