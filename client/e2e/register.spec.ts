import { expect, test } from "@playwright/test";
import { createUser, loginViaUI, reset } from "./helpers";

test.beforeEach(() => reset());

test("a visitor can create an account and reaches their profile", async ({
  page,
}) => {
  const email = `e2e-register-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/profile/);
});

test("a member can sign in through the UI", async ({ page }) => {
  const user = createUser();
  await loginViaUI(page, user.email);
});
