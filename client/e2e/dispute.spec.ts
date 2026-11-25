import { expect, test } from "@playwright/test";
import {
  accept,
  API_URL,
  createUser,
  loginToken,
  loginViaUI,
  propose,
  publishListing,
  reset,
  secureFunds,
} from "./helpers";

test.beforeEach(() => reset());

test("a buyer opens a dispute and an admin resolves it with a refund", async ({
  request,
  browser,
}) => {
  const seller = createUser({ verified: true, onboarded: true });
  const buyer = createUser({ verified: true });
  const admin = createUser({ verified: true, admin: true });
  const sellerToken = await loginToken(request, seller.email);
  const buyerToken = await loginToken(request, buyer.email);

  const listingId = await publishListing(request, sellerToken);
  const dealId = await propose(request, buyerToken, listingId);
  await accept(request, sellerToken, dealId);
  await secureFunds(request, buyerToken, dealId);

  const disputeResponse = await request.post(`${API_URL}/api/v1/disputes`, {
    headers: {
      Authorization: `Bearer ${buyerToken}`,
      Origin: "http://localhost:3000",
    },
    data: { dealId, reason: "The item was not as described" },
  });
  expect(disputeResponse.status(), await disputeResponse.text()).toBe(201);

  // Admin reviews the queue in the browser.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginViaUI(adminPage, admin.email);
  await adminPage.goto("/admin");
  await adminPage.getByRole("tab", { name: "Disputes" }).click();
  await expect(adminPage.getByText("The item was not as described")).toBeVisible();

  await adminPage.getByRole("button", { name: "Review" }).click();
  await adminPage.getByLabel("Resolution").selectOption("REFUND");
  await adminPage.getByRole("button", { name: "Resolve" }).click();
  await expect(
    adminPage.getByText("No open disputes").or(
      adminPage.getByText("The queue is clear."),
    ),
  ).toBeVisible();

  const dealResponse = await request.get(`${API_URL}/api/v1/deals/${dealId}`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  const deal = (await dealResponse.json()) as {
    data: { deal: { status: string } };
  };
  expect(deal.data.deal.status).toBe("RESOLVED");

  await adminContext.close();
});
