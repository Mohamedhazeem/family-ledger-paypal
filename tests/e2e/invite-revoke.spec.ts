import { expect, test, type Page } from "@playwright/test";

const COORDINATOR_EMAIL = "alex.morgan@example.com";
const COORDINATOR_PASSWORD = "DemoPass123!";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(COORDINATOR_EMAIL);
  await page.getByLabel("Password").fill(COORDINATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("revoked invitation link opens as 404", async ({ page }) => {
  await signIn(page);

  const { disbursementId, beneficiaryUrl } = await page.evaluate(async () => {
    const createRes = await fetch("/api/disbursements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiary: {
          displayName: "Revoke E2E",
          invitationEmail: "revoke-e2e@example.com",
          payPalRecipientEmail: "revoke-e2e.paypal@example.com",
          preferredLanguage: "en",
        },
        amountText: "500.00",
        currency: "USD",
        supportNote: "Revoke e2e",
        plan: { summary: "R", items: [{ category: "Rent", amountText: "300.00" }] },
      }),
    });
    const disbursement = await createRes.json();
    const invRes = await fetch(`/api/disbursements/${disbursement.id}/invitations`, { method: "POST" });
    const invitation = await invRes.json();
    return { disbursementId: disbursement.id as string, beneficiaryUrl: invitation.url as string };
  });

  await page.goto(`/disbursements/${disbursementId}`);
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Revoked", { exact: true }).first()).toBeVisible();

  await page.goto(beneficiaryUrl);
  await expect(page).toHaveTitle(/404/);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
