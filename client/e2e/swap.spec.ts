import { expect, test } from "@playwright/test";
import {
  accept,
  API_URL,
  createUser,
  loginToken,
  loginViaUI,
  proposeSwap,
  publishListing,
  reset,
} from "./helpers";

test.beforeEach(() => reset());

test("a swap completes only after both parties confirm the handoff", async ({
  request,
  browser,
}) => {
  const seller = createUser({ verified: true, onboarded: true });
  const buyer = createUser({ verified: true });
  const sellerToken = await loginToken(request, seller.email);
  const buyerToken = await loginToken(request, buyer.email);

  const target = await publishListing(
    request,
    sellerToken,
    "E2E wanted item",
    "BOTH",
  );
  const offered = await publishListing(
    request,
    buyerToken,
    "E2E offered item",
    "EXCHANGE",
  );
  const dealId = await proposeSwap(request, buyerToken, target, [offered]);
  await accept(request, sellerToken, dealId);

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await loginViaUI(buyerPage, buyer.email);
  await buyerPage.goto(`/deals/${dealId}`);
  await expect(buyerPage.getByText("Confirm the swap")).toBeVisible();
  await expect(
    buyerPage.getByText("You: Not confirmed", { exact: false }),
  ).toBeVisible();
  await buyerPage.getByRole("button", { name: "I handed over my item" }).click();
  await expect(
    buyerPage.getByText("You confirmed. Waiting for the other party."),
  ).toBeVisible();

  const dealResponse = await request.get(`${API_URL}/api/v1/deals/${dealId}`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  const pending = (await dealResponse.json()) as {
    data: { deal: { status: string } };
  };
  expect(pending.data.deal.status).toBe("PAYMENT_PENDING");

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await loginViaUI(sellerPage, seller.email);
  await sellerPage.goto(`/deals/${dealId}`);
  await sellerPage.getByRole("button", { name: "I handed over my item" }).click();
  await expect(sellerPage.getByText("Rate this deal")).toBeVisible();

  const finalResponse = await request.get(`${API_URL}/api/v1/deals/${dealId}`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const final = (await finalResponse.json()) as {
    data: { deal: { status: string } };
  };
  expect(final.data.deal.status).toBe("COMPLETED");

  await buyerContext.close();
  await sellerContext.close();
});
