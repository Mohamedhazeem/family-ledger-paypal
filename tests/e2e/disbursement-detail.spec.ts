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

test("coordinator compare screen: versions, diff, acknowledge, send enabled", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);

  // Arrange via the real APIs: create (v1), invite, beneficiary suggests (v2).
  const disbursementId = await page.evaluate(async () => {
    const createRes = await fetch("/api/disbursements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiary: {
          displayName: "Detail Test",
          invitationEmail: "detail-test@example.com",
          payPalRecipientEmail: "detail.paypal@example.com",
          preferredLanguage: "en",
        },
        amountText: "500.00",
        currency: "USD",
        supportNote: "Compare screen test",
        plan: {
          summary: "Detail test plan",
          items: [
            { category: "Rent", amountText: "300.00" },
            { category: "Food", amountText: "150.00" },
          ],
        },
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
        items: [
          { category: "Rent", amountText: "250.00" },
          { category: "Food", amountText: "150.00" },
          { category: "Medicine", amountText: "50.00" },
        ],
        explanation: "School starts next month",
      }),
    });
    return disbursement.id as string;
  });

  await page.goto(`/disbursements/${disbursementId}`);

  // Both plans side by side.
  await expect(page.getByRole("heading", { name: "Version 1", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Version 2", exact: true })).toBeVisible();
  await expect(page.getByText("School starts next month")).toBeVisible();

  // Deterministic diff text.
  await expect(page.getByText(/Rent: \$300\.00 → \$250\.00/)).toBeVisible();
  await expect(page.getByText(/Added Medicine/)).toBeVisible();

  // Send payment stays enabled even without acknowledgment (spec §4.4).
  await expect(page.getByRole("button", { name: /Send full payment/ })).toBeEnabled();

  // Acknowledge moves the plan status.
  await page.getByRole("button", { name: "Acknowledge plan" }).click();
  await expect(page.getByText("Acknowledged. The plan is now mutually acknowledged.")).toBeVisible();

  // Send payment is still enabled after acknowledgment too.
  await expect(page.getByRole("button", { name: /Send full payment/ })).toBeEnabled();
});
