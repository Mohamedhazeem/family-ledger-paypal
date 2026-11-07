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

test("register: filter narrows rows, sort reorders, row click opens details", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");

  const grid = page.locator(".ag-root");
  await expect(grid.locator(".ag-row")).not.toHaveCount(0);

  // Filter narrows to the seeded reference.
  await page.getByPlaceholder(/Search reference/).fill("FL-SEED-001");
  await expect(grid.locator(".ag-row").first()).toContainText("FL-SEED-001");
  const filteredCount = await grid.locator(".ag-row").count();
  expect(filteredCount).toBeLessThan(10);
  await page.getByPlaceholder(/Search reference/).fill("");

  // Sort by amount via the toolbar toggle (ascending).
  await page.getByRole("button", { name: "Sort by amount" }).click();
  const amountCells = async () =>
    (await grid
      .locator('.ag-grid-viewport .ag-row .ag-cell[col-id="amountMinor"]')
      .allInnerTexts())
      .map((t) => Number(t.replace(/[$,]/g, "")));
  // Wait until the visible order is fully sorted (settles after the click).
  await expect
    .poll(async () => {
      const asc = await amountCells();
      const expected = [...asc].sort((a, b) => a - b).slice(0, asc.length);
      return asc.join(",") === expected.join(",") ? "sorted" : `not:${asc.join(",")}`;
    }, { timeout: 15_000 })
    .toBe("sorted");

  // Row click opens the reference again (reference is a link to the detail page).
  await grid.locator(".ag-row").first().locator("a").click();
  await expect(page).toHaveURL(/\/disbursements\/.+/);
  await expect(page.getByText("Full payment amount")).toBeVisible();
});
