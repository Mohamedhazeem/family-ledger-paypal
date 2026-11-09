/**
 * HTML + plain-text templates for the beneficiary invitation email
 * (spec §6 Step 4). Amounts/IDs are never translated here; only
 * display copy. Canonical data stays in the link.
 */

export interface InvitationEmailInput {
  beneficiaryDisplayName: string;
  programmeName: string;
  url: string;
  expiresAt: Date;
}

export function buildInvitationEmail(input: InvitationEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { beneficiaryDisplayName, programmeName, url, expiresAt } = input;
  const expiry = expiresAt.toLocaleDateString();
  const greeting = beneficiaryDisplayName ? `Hello ${beneficiaryDisplayName},` : "Hello,";

  const subject = `${programmeName} shared a support plan with you`;

  const text =
    `${greeting}\n\n` +
    `${programmeName} has shared a family support plan with you.\n\n` +
    `Review it here (link valid until ${expiry}):\n${url}\n\n` +
    "This is a voluntary support plan. It does not restrict how you use the money you receive.\n\n" +
    "Your privacy matters: you can accept, suggest changes, or decline to share a plan. " +
    "Responding is never a condition of receiving your support payment.\n";

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
              <td style="padding:24px 32px;" align="center">
                <a href="${escapeAttr(url)}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;">
                  Review your plan
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;">
                <p style="margin:0;font-size:13px;color:#64748b;">Or copy this link into your browser:</p>
                <p style="margin:6px 0 0;font-size:12px;word-break:break-all;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">${escapeHtml(url)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px;">
                <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;">
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#854d0e;">
                    <strong>Voluntary plan.</strong> This is a voluntary support plan. It does not restrict how you use
                    the money you receive. Responding is never a condition of receiving your support payment.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">This link is valid until ${escapeHtml(expiry)}. If it expires, ask your coordinator for a new one.</p>
                <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">FamilyLedger · consent-first family support. We never ask for your password or payment details by email.</p>
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
