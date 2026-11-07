import { expect, test, type Page } from "@playwright/test";

const COORDINATOR_EMAIL = "alex.morgan@example.com";
const COORDINATOR_PASSWORD = "DemoPass123!";
const COORDINATOR_NOTE = "OPERATOR-ONLY timeline note 98765";
const EXPLANATION = "BENEFICIARY-ONLY explanation 54321";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(COORDINATOR_EMAIL);
  await page.getByLabel("Password").fill(COORDINATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("shared timeline: coordinator sees all entries, beneficiary sees the allowed subset", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);

  const { disbursementId, beneficiaryUrl } = await page.evaluate(
    async ({ coordinatorNote, explanation }) => {
      const createRes = await fetch("/api/disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary: {
            displayName: "Timeline E2E",
            invitationEmail: "timeline-e2e@example.com",
            payPalRecipientEmail: "timeline-e2e.paypal@example.com",
            preferredLanguage: "en",
          },
          amountText: "500.00",
          currency: "USD",
          supportNote: coordinatorNote,
          shareSupportNoteWithBeneficiary: false,
          plan: { summary: "Timeline e2e", items: [{ category: "Rent", amountText: "300.00" }] },
        }),
      });
      const disbursement = await createRes.json();
      const invRes = await fetch(`/api/disbursements/${disbursement.id}/invitations`, { method: "POST" });
      const invitation = await invRes.json();
      const token = invitation.url.split("/").pop();
      await fetch(`/api/beneficiary/${token}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ category: "Rent", amountText: "250.00" }],
          explanation,
        }),
      });
      await fetch(`/api/beneficiary/${token}/accept`, { method: "POST" });
      await fetch(`/api/disbursements/${disbursement.id}/acknowledge`, { method: "POST" });
      return { disbursementId: disbursement.id as string, beneficiaryUrl: invitation.url as string };
    },
    { coordinatorNote: COORDINATOR_NOTE, explanation: EXPLANATION },
  );

  // Coordinator timeline: full history in order.
  await page.goto(`/disbursements/${disbursementId}`);
  const timeline = page.locator("ol").filter({ hasText: "Disbursement created" });
  // Timeline entries in chronological order.
  const entries = await timeline.locator("li").allTextContents();
  expect(entries).toHaveLength(6);
  expect(entries[0]).toContain("Disbursement created");
  expect(entries[1]).toContain("Plan draft generated");
  expect(entries[2]).toContain("Invitation created");
  await expect(page.getByText("Beneficiary suggested changes")).toBeVisible();
  await expect(page.getByText("Beneficiary accepted the plan")).toBeVisible();
  await expect(page.getByText("Coordinator acknowledged the plan")).toBeVisible();

  // Beneficiary timeline: only allowed entries; no private content.
  const context = await page.context().browser()!.newContext();
  const beneficiary = await context.newPage();
  await beneficiary.goto(beneficiaryUrl);
  const bodyText = await beneficiary.locator("body").innerText();
  expect(bodyText).toContain("Disbursement created");
  expect(bodyText).toContain("You accepted the plan");
  expect(bodyText).not.toContain(COORDINATOR_NOTE);
  expect(bodyText).not.toContain(EXPLANATION);
  await context.close();
});
