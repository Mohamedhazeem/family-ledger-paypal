"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PlanItemsEditor, type PlanItemDraft } from "./plan-items-editor";
import { decimalToMinor, isValidDecimalText, minorToDecimal } from "./money-client";

type Language = "en" | "ta" | "hi";
type Errors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFields(fields: {
  displayName: string;
  invitationEmail: string;
  payPalRecipientEmail: string;
  amountText: string;
  supportNote: string;
}): Errors {
  const errors: Errors = {};
  if (!fields.displayName.trim()) errors.displayName = "Beneficiary name is required.";
  if (!EMAIL_PATTERN.test(fields.invitationEmail.trim()))
    errors.invitationEmail = "Enter a valid invitation email.";
  if (!EMAIL_PATTERN.test(fields.payPalRecipientEmail.trim()))
    errors.payPalRecipientEmail = "Enter a valid PayPal recipient email.";
  if (!fields.amountText.trim()) errors.amountText = "Full payment amount is required.";
  else if (!isValidDecimalText(fields.amountText))
    errors.amountText = "Amount must be a decimal like 500.00.";
  else if ((decimalToMinor(fields.amountText) ?? 0) <= 0)
    errors.amountText = "Amount must be greater than zero.";
  if (!fields.supportNote.trim()) errors.supportNote = "Support intention is required.";
  return errors;
}

export function NewDisbursementForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [invitationEmail, setInvitationEmail] = useState("");
  const [payPalRecipientEmail, setPayPalRecipientEmail] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [amountText, setAmountText] = useState("");
  const [supportNote, setSupportNote] = useState("");
  const [shareNote, setShareNote] = useState(false);
  const [items, setItems] = useState<PlanItemDraft[]>([]);
  const [planSummary, setPlanSummary] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const totalMinor = decimalToMinor(amountText);
  const allocated = items.reduce((sum, item) => sum + (decimalToMinor(item.amountText) ?? 0), 0);
  const overTotal = totalMinor !== null && allocated > totalMinor;
  const remainder = totalMinor !== null && !overTotal ? totalMinor - allocated : 0;
  const itemsInvalid = items.some(
    (item) => item.amountText.trim() !== "" && decimalToMinor(item.amountText) === null,
  );
  const canSave = !saving && !overTotal && !itemsInvalid;
  const progress = Math.min(
    100,
    Math.round(
      (((displayName.trim() ? 1 : 0) +
        (EMAIL_PATTERN.test(invitationEmail.trim()) ? 1 : 0) +
        (EMAIL_PATTERN.test(payPalRecipientEmail.trim()) ? 1 : 0) +
        (totalMinor ? 1 : 0) +
        (supportNote.trim() ? 1 : 0)) /
        5) *
        100,
    ),
  );

  async function extract() {
    const extractErrors: Errors = {};
    if (!supportNote.trim()) extractErrors.supportNote = "Support intention is required.";
    if (!amountText.trim()) extractErrors.amountText = "Full payment amount is required.";
    else if (!isValidDecimalText(amountText))
      extractErrors.amountText = "Amount must be a decimal like 500.00.";
    setErrors(extractErrors);
    if (Object.keys(extractErrors).length > 0) return;

    setExtracting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/ai/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: supportNote,
          amountMinor: decimalToMinor(amountText),
          currency: "USD",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Could not extract a plan.");
        return;
      }
      setItems(
        data.items.map((item: { category: string; amountText: string | null }) => ({
          category: item.category,
          amountText: item.amountText ?? "",
        })),
      );
      setPlanSummary(data.summary ?? "");
      setExtracted(true);
      if (data.requiresClarification && data.clarificationQuestion) {
        setServerError(`AI clarification: ${data.clarificationQuestion}`);
      }
    } catch {
      setServerError("Could not reach the AI service. Try again.");
    } finally {
      setExtracting(false);
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fieldErrors = validateFields({
      displayName,
      invitationEmail,
      payPalRecipientEmail,
      amountText,
      supportNote,
    });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    if (overTotal || itemsInvalid) {
      setServerError("Fix the allocation plan before saving.");
      return;
    }

    setSaving(true);
    setServerError(null);
    try {
      const planItems = items
        .filter((item) => item.category.trim() !== "" || item.amountText.trim() !== "")
        .map((item) => ({
          category: item.category.trim(),
          amountText: item.amountText.trim() === "" ? null : item.amountText.trim(),
        }));
      const res = await fetch("/api/disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary: {
            displayName: displayName.trim(),
            invitationEmail: invitationEmail.trim(),
            payPalRecipientEmail: payPalRecipientEmail.trim(),
            preferredLanguage: language,
          },
          amountText: amountText.trim(),
          currency: "USD",
          supportNote: supportNote.trim(),
          shareSupportNoteWithBeneficiary: shareNote,
          plan: { summary: planSummary, items: planItems },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Could not save the disbursement.");
        return;
      }
      router.push(`/disbursements/${data.id}`);
      router.refresh();
    } catch {
      setServerError("Could not save the disbursement. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="space-y-6">
        <section aria-labelledby="new-step-1" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-linear-to-r from-indigo-50/80 to-white px-5 py-4 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-bold text-white shadow-sm">1</span>
            <div className="min-w-0">
              <h2 id="new-step-1" className="text-base font-semibold text-slate-900">Beneficiary and payment</h2>
              <p className="text-sm text-slate-500">The recipient gets the full amount. PayPal details stay server-side.</p>
            </div>
          </div>
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
            <Field label="Beneficiary display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Priya Raman" autoComplete="name" />
              {errors.displayName ? <span className="text-sm text-rose-600">{errors.displayName}</span> : null}
            </Field>
            <Field label="Preferred language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="en">English</option>
                <option value="ta">Tamil</option>
                <option value="hi">Hindi</option>
              </select>
            </Field>
            <Field label="Invitation email" hint="The beneficiary invitation link goes here.">
              <Input type="email" value={invitationEmail} onChange={(e) => setInvitationEmail(e.target.value)} placeholder="priya@example.com" autoComplete="email" />
              {errors.invitationEmail ? <span className="text-sm text-rose-600">{errors.invitationEmail}</span> : null}
            </Field>
            <Field label="PayPal sandbox recipient email" hint="Stored encrypted, server-only.">
              <Input type="email" value={payPalRecipientEmail} onChange={(e) => setPayPalRecipientEmail(e.target.value)} placeholder="priya.paypal@example.com" autoComplete="email" />
              {errors.payPalRecipientEmail ? <span className="text-sm text-rose-600">{errors.payPalRecipientEmail}</span> : null}
            </Field>
            <Field label="Full payment amount (USD)">
              <Input value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="500.00" inputMode="decimal" />
              {errors.amountText ? <span className="text-sm text-rose-600">{errors.amountText}</span> : null}
            </Field>
            <Field label="Support intention">
              <textarea
                value={supportNote}
                onChange={(e) => setSupportNote(e.target.value)}
                rows={4}
                placeholder="Please allocate $300 for rent, $150 for school fees and $50 for food."
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {errors.supportNote ? <span className="text-sm text-rose-600">{errors.supportNote}</span> : null}
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
              <input className="mt-0.5 h-4 w-4 accent-indigo-600" type="checkbox" checked={shareNote} onChange={(e) => setShareNote(e.target.checked)} />
              <span>Share the support note with the beneficiary</span>
            </label>
          </CardContent>
        </section>

        <section aria-labelledby="new-step-2" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-linear-to-r from-emerald-50/80 to-white px-5 py-4 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-sm">2</span>
            <div className="min-w-0 flex-1">
              <h2 id="new-step-2" className="text-base font-semibold text-slate-900">Shared allocation plan</h2>
              <p className="text-sm text-slate-500">Voluntary categories only. The payout is never split by category.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={extract} disabled={extracting} className="rounded-full">
              <Sparkles className="h-4 w-4 text-indigo-600" /> {extracting ? "Extracting…" : extracted ? "Extract again" : "Extract plan"}
            </Button>
          </div>
          <CardContent className="space-y-4 pt-5">
            <PlanItemsEditor items={items} totalMinor={totalMinor} onChange={setItems} />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="submit" size="lg" disabled={!canSave} className="w-full sm:w-auto">
                <Wallet className="h-4 w-4" /> {saving ? "Saving…" : "Save disbursement"}
              </Button>
            </div>
          </CardContent>
        </section>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <Card className="overflow-hidden rounded-3xl">
          <CardHeader title="Review" description="Live summary before you save." />
          <CardContent className="space-y-4">
            {serverError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{serverError}</div> : null}
            <div className="rounded-2xl bg-indigo-600 p-4 text-white">
              <p className="text-xs uppercase tracking-wider text-indigo-200">Payment amount</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{totalMinor === null ? "—" : `$${minorToDecimal(totalMinor)}`}</p>
              <p className="text-xs text-indigo-100">One unrestricted USD payout</p>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Beneficiary</dt><dd className="font-medium text-slate-900">{displayName || "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Language</dt><dd className="font-medium uppercase text-slate-900">{language}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Plan allocated</dt><dd className="font-medium tabular-nums text-slate-900">${minorToDecimal(allocated)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Flexible remainder</dt><dd className="font-medium tabular-nums text-slate-900">${minorToDecimal(remainder)}</dd></div>
            </dl>
            <div>
              <div className="mb-2 flex justify-between text-xs text-slate-500"><span>Fields complete</span><span>{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
            {overTotal ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">Allocation exceeds the total. Adjust before saving.</p> : <p className="flex gap-2 text-xs leading-relaxed text-slate-500"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />The full payment is sent regardless of how the plan is used.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-5 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">What happens next</p>
            <p>1. Save immutable plan v1.</p><p>2. Create a secure invitation.</p><p>3. Beneficiary accepts, suggests, or declines.</p>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
