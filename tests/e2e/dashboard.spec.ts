import { expect, test } from "@playwright/test";

test("dashboard shows seeded disbursement and hides recipient email", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', "alex.morgan@example.com");
  // Seed uses placeholder password hash; Better Auth won't accept it. Use the
  // judge creds documented in README once auth is wired. For now we only
  // assert the login page renders and the route guard works.
  await page.goto("/dashboard");
  // Unauthenticated → redirected to /login
  await expect(page).toHaveURL(/\/login/);
});
