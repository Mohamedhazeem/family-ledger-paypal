/**
 * Plan-proposal email template (spec §6 Step 4, ADR-0016).
 *
 * Renders the LATEST plan version — categories, canonical amounts and the
 * secure invitation link — for delivery to the beneficiary. Amounts are
 * integer minor units formatted server-side with integer arithmetic and
 * are never translated. The free-text support note is deliberately NOT
 * included: it is coordinator-facing and only ever shown in the portal
 * when the coordinator marked it shareable.
 */
import type { PlanProposalEmailData } from "@/application/ports/email";
import { formatMinor } from "@/domain/value-objects/money";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Null amount means the category was left flexible/unallocated. */
function money(minor: bigint | null): string {
  return minor === null ? "Flexible" : `$${formatMinor(minor)}`;
}

export function buildPlanProposalEmail(data: PlanProposalEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const {
    beneficiaryDisplayName,
    programmeName,
    amountMinor,
    currency,
    items,
    unallocatedMinor,
    url,
    expiresAt,
  } = data;
  const greeting = beneficiaryDisplayName ? `Hello ${beneficiaryDisplayName},` : "Hello,";
  const expiry = expiresAt.toLocaleDateString();
  const subject = `${programmeName} shared a support plan with you`;

  const lines = items.map((item) => `  - ${item.category}: ${money(item.amountMinor)}`);
  const unallocatedLine =
    unallocatedMinor > 0n ? `\n  - Flexible / unallocated support: $${formatMinor(unallocatedMinor)}` : "";

  const text =
    `${greeting}\n\n` +
    `${programmeName} has shared a family support plan with you.\n\n` +
    `Total support amount: $${formatMinor(amountMinor)} ${currency}\n\n` +
    `Proposed allocation:\n${lines.join("\n")}${unallocatedLine}\n\n` +
    `Review and respond here (link valid until ${expiry}):\n${url}\n\n` +
    "This is a voluntary support plan. It does not restrict how you use the money you receive.\n" +
    "Responding is never a condition of receiving your support payment.\n";

  const rows = items
    .map(
      (item) => `
          <tr>
            <td style="padding:10px 0;font-size:15px;color:#334155;">${escapeHtml(item.category)}</td>
            <td style="padding:10px 0;text-align:right;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(money(item.amountMinor))}</td>
          </tr>`,
    )
    .join("");
  const unallocatedRow =
    unallocatedMinor > 0n
      ? `
          <tr>
            <td style="padding:10px 0;font-size:15px;color:#334155;">Flexible / unallocated support</td>
            <td style="padding:10px 0;text-align:right;font-size:15px;font-weight:600;color:#0f172a;">$${formatMinor(unallocatedMinor)}</td>
          </tr>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
            <tr>
              <td style="padding:28px 32px 8px;">
                <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;">${escapeHtml(programmeName)}</p>
                <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#0f172a;">Your support plan is ready to review</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(greeting)}</p>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#334155;">
                  ${escapeHtml(programmeName)} has shared a family support plan with you. You can review the
                  proposed categories and amounts, then choose to accept, suggest changes, or decline to share a plan.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px;">
                <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Total support amount</p>
                <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#0f172a;">$${formatMinor(amountMinor)} <span style="font-size:15px;font-weight:500;color:#64748b;">${escapeHtml(currency)}</span></p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
                  ${rows}${unallocatedRow}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px;" align="center">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;">
                  Review your plan
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;">
                <p style="margin:0;font-size:13px;color:#64748b;">Or copy this link into your browser (valid until ${expiry}):</p>
                <p style="margin:6px 0 0;font-size:12px;word-break:break-all;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">${escapeHtml(url)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;">
                <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;">
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#854d0e;">
                    <strong>Voluntary plan.</strong> This is a voluntary support plan. It does not restrict how you use
                    the money you receive. Responding is never a condition of receiving your support payment.
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
