import { expect, test } from "@playwright/test";
import {
  createUser,
  loginToken,
  publishListing,
  reset,
} from "./helpers";

test.beforeEach(() => reset());

test("a guest can browse listings and open a detail page", async ({
  page,
  request,
}) => {
  const seller = createUser({ verified: true, onboarded: true });
  const sellerToken = await loginToken(request, seller.email);
  const listingId = await publishListing(request, sellerToken, "E2E browse camera");

  await page.goto("/browse");
  await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
  await expect(page.getByText("E2E browse camera").first()).toBeVisible();

  await page.getByText("E2E browse camera").first().click();
  await expect(page).toHaveURL(new RegExp(`/listings/${listingId}`));
  await expect(
    page.getByRole("heading", { name: "E2E browse camera" }),
  ).toBeVisible();
});

test("browse filters live in the URL and an empty search shows no results", async ({
  page,
}) => {
  await page.goto("/browse?q=definitely-not-an-item&location=Nowhere");
  await expect(page).toHaveURL(/q=definitely-not-an-item/);
  await expect(page.getByText("No listings found")).toBeVisible();
});
