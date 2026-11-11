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

test("send plan delivers the proposal and delete removes a never-sent draft", async ({ page }) => {
  await signIn(page);

  const { disbursementId, publicReference } = await page.evaluate(async () => {
    const res = await fetch("/api/disbursements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiary: {
          displayName: "Send Plan E2E",
          invitationEmail: `sendplan-e2e-${Date.now()}@example.com`,
          payPalRecipientEmail: "sendplan-e2e.paypal@example.com",
          preferredLanguage: "en",
        },
        amountText: "500.00",
        currency: "USD",
        supportNote: "Send plan e2e",
        plan: { summary: "E2E", items: [{ category: "Rent", amountText: "300.00" }] },
      }),
    });
    const created = await res.json();
    return {
      disbursementId: created.id as string,
      publicReference: created.publicReference as string,
    };
  });

  await page.goto(`/disbursements/${disbursementId}`);

  // Send plan: the latest plan is delivered (or the copy fallback is offered).
  await page.getByRole("button", { name: "Send plan to beneficiary" }).click();
  await expect(page.getByText("Plan sent")).toBeVisible();
  await expect(page.getByText(/Email not configured|Sent to/)).toBeVisible();
  await expect(page.getByText(/\/beneficiary\//)).toBeVisible();

  // Delete draft: two-step confirm, then back on the register.
  await page.getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page).toHaveURL(/\/disbursements$/);
  await expect(page.getByText(publicReference)).toHaveCount(0);
});
