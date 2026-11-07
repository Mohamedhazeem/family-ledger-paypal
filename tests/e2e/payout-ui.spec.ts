import { expect, test, type Page } from "@playwright/test";

const COORDINATOR_EMAIL = "alex.morgan@example.com";
const COORDINATOR_PASSWORD = "DemoPass123!";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(COORDINATOR_EMAIL);
  await page.getByLabel("Password").fill(COORDINATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test("dual-status UI: both badges, MOCK badge, raw unknown value verbatim", async ({ page }) => {
  await signIn(page);

  // The seeded MOCK demo row carries two unknown (FOO) raw statuses.
  await page.goto("/disbursements/seed-disbursement-mock");

  await expect(page.getByText("MOCK PAYMENT")).toBeVisible();
  await expect(page.getByText("Unknown (FOO)")).toHaveCount(2);
  await expect(page.getByText("Unknown (FOO)").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh status" })).toBeVisible();

  // Send payment stays enabled regardless of the unknown statuses.
  await expect(page.getByRole("button", { name: /Send full payment/ })).toBeEnabled();
});

test("sandbox row shows both badges without a MOCK badge", async ({ page }) => {
  await signIn(page);
  const disbursementId = await page.evaluate(async () => {
    const res = await fetch("/api/disbursements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiary: {
          displayName: "UI Badges",
          invitationEmail: "uibadges@example.com",
          payPalRecipientEmail: "uibadges.paypal@example.com",
          preferredLanguage: "en",
        },
        amountText: "500.00",
        currency: "USD",
        supportNote: "Badges check",
      }),
    });
    const data = await res.json();
    return data.id as string;
  });

  await page.goto(`/disbursements/${disbursementId}`);
  await expect(page.getByText("Not submitted")).toHaveCount(2);
  await expect(page.getByText("MOCK PAYMENT")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh status" })).toBeVisible();
});
