import { expect, test, type Page } from "@playwright/test";

const COORDINATOR_EMAIL = "alex.morgan@example.com";
const COORDINATOR_PASSWORD = "DemoPass123!";

async function signIn(page: Page) {
  // Login via the real sign-in form (seeded coordinator).
  await page.goto("/login");
  await page.getByLabel("Email").fill(COORDINATOR_EMAIL);
  await page.getByLabel("Password").fill(COORDINATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("new disbursement (Slice 2.6)", () => {
  test("extract → edit → save creates a row in the register", async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page);
    await page.goto("/disbursements/new");

    const beneficiaryName = `E2E Beneficiary`;
    await page.getByLabel("Beneficiary display name").fill(beneficiaryName);
    await page.getByLabel("Invitation email").fill("e2e.beneficiary@example.com");
    await page.getByLabel("PayPal sandbox recipient email").fill("e2e.paypal@example.com");
    await page.getByLabel("Full payment amount (USD)").fill("500.00");
    await page
      .getByLabel("Support intention")
      .fill("Please allocate $300 for rent, $150 for school fees and $50 for food.");

    await page.getByRole("button", { name: "Extract plan" }).click();

    // Real AI extraction (live provider): wait until 3 categories appear.
    await expect(page.getByLabel("Category 1", { exact: true })).toHaveValue("Rent", { timeout: 120_000 });
    await expect(page.getByLabel("Category 2", { exact: true })).toHaveValue("School fees");
    await expect(page.getByLabel("Category 3", { exact: true })).toHaveValue("Food");
    await expect(page.getByLabel("Amount for category 1", { exact: true })).toHaveValue("300.00");

    // Edit one amount: the allocated sum must update.
    await page.getByLabel("Amount for category 1", { exact: true }).fill("310.00");
    await expect(page.getByText("$510.00").first()).toBeVisible();
    await expect(page.getByText("Allocations exceed the disbursement total")).toBeVisible();

    // Fix it back and save.
    await page.getByLabel("Amount for category 1", { exact: true }).fill("300.00");
    await expect(page.getByText("$500.00").first()).toBeVisible();
    await page.getByRole("button", { name: "Save disbursement" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(beneficiaryName)).toBeVisible();
  });

  test("empty fields show validation messages", async ({ page }) => {
    await signIn(page);
    await page.goto("/disbursements/new");

    await page.getByRole("button", { name: "Save disbursement" }).click();

    await expect(page.getByText("Beneficiary name is required.")).toBeVisible();
    await expect(page.getByText("Enter a valid invitation email.")).toBeVisible();
    await expect(page.getByText("Enter a valid PayPal recipient email.")).toBeVisible();
    await expect(page.getByText("Full payment amount is required.")).toBeVisible();
    await expect(page.getByText("Support intention is required.")).toBeVisible();
  });
});
