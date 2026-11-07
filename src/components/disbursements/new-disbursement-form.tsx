"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

  const totalMinor = decimalToMinor(amountText);
  const allocated = items.reduce((sum, item) => sum + (decimalToMinor(item.amountText) ?? 0), 0);
  const overTotal = totalMinor !== null && allocated > totalMinor;
  const itemsInvalid = items.some(
    (item) => item.amountText.trim() !== "" && decimalToMinor(item.amountText) === null,
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
      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError("Could not save the disbursement. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      {serverError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {serverError}
        </div>
      ) : null}

      <Card>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
          <Field label="Beneficiary display name">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Priya Raman"
            />
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
            <Input
              type="email"
              value={invitationEmail}
              onChange={(e) => setInvitationEmail(e.target.value)}
              placeholder="priya@example.com"
            />
            {errors.invitationEmail ? (
              <span className="text-sm text-rose-600">{errors.invitationEmail}</span>
            ) : null}
          </Field>
          <Field label="PayPal sandbox recipient email" hint="Stored encrypted, server-only.">
            <Input
              type="email"
              value={payPalRecipientEmail}
              onChange={(e) => setPayPalRecipientEmail(e.target.value)}
              placeholder="priya.paypal@example.com"
            />
            {errors.payPalRecipientEmail ? (
              <span className="text-sm text-rose-600">{errors.payPalRecipientEmail}</span>
            ) : null}
          </Field>
          <Field label="Full payment amount (USD)">
            <Input
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="500.00"
              inputMode="decimal"
            />
            {errors.amountText ? <span className="text-sm text-rose-600">{errors.amountText}</span> : null}
          </Field>
          <Field label="Support intention">
            <textarea
              value={supportNote}
              onChange={(e) => setSupportNote(e.target.value)}
              rows={3}
              placeholder="Please allocate $300 for rent, $150 for school fees and $50 for food."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {errors.supportNote ? <span className="text-sm text-rose-600">{errors.supportNote}</span> : null}
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={shareNote} onChange={(e) => setShareNote(e.target.checked)} />
            Share the support note with the beneficiary
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <PlanItemsEditor items={items} totalMinor={totalMinor} onChange={setItems} />
          {totalMinor !== null ? (
            <p className="text-xs text-slate-500">
              Plan total: ${minorToDecimal(totalMinor)} USD. The payout is always the full amount;
              categories are a shared plan, not restrictions.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={extract} disabled={extracting}>
              {extracting ? "Extracting…" : "Extract plan"}
            </Button>
            <Button type="submit" disabled={saving || overTotal || itemsInvalid}>
              {saving ? "Saving…" : "Save disbursement"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
