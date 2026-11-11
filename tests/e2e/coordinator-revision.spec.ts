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

test("coordinator adjusts the proposal and asks a clarification", async ({ page }) => {
  await signIn(page);

  const { disbursementId } = await page.evaluate(async () => {
    const res = await fetch("/api/disbursements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiary: {
          displayName: "Adjust E2E",
          invitationEmail: `adjust-e2e-${Date.now()}@example.com`,
          payPalRecipientEmail: "adjust-e2e.paypal@example.com",
          preferredLanguage: "en",
        },
        amountText: "500.00",
        currency: "USD",
        supportNote: "Adjust e2e",
        plan: {
          summary: "E2E",
          items: [
            { category: "Rent", amountText: "300.00" },
            { category: "School", amountText: "150.00" },
            { category: "Food", amountText: "50.00" },
          ],
        },
      }),
    });
    const created = await res.json();
    return { disbursementId: created.id as string };
  });

  await page.goto(`/disbursements/${disbursementId}`);

  // Adjust the proposal: new total + a new category -> a new coordinator version.
  await page.getByRole("button", { name: "Adjust proposal" }).click();
  await page.getByLabel("Full support amount").fill("600.00");
  await page.getByRole("button", { name: "Add category" }).click();
  await page.getByLabel("Category 4", { exact: true }).fill("Transport");
  await page.getByLabel("Amount for category 4", { exact: true }).fill("100.00");
  await page.getByRole("button", { name: "Save as new version" }).click();

  await expect(page.getByRole("heading", { name: "Version 2", exact: true })).toBeVisible();
  await expect(page.getByText("Coordinator", { exact: true }).first()).toBeVisible();

  // Ask a clarification; it must appear in the beneficiary portal.
  await page.getByRole("button", { name: "Ask a clarification" }).click();
  await page.getByLabel("Clarification question").fill("Could you tell us more about the transport costs?");
  await page.getByRole("button", { name: "Send question" }).click();

  const portalUrl = await page.evaluate(async (id: string) => {
    const res = await fetch(`/api/disbursements/${id}/invitations`, { method: "POST" });
    const data = await res.json();
    return data.url as string;
  }, disbursementId);

  await page.goto(portalUrl);
  await expect(page.getByText("Could you tell us more about the transport costs?")).toBeVisible();
});
