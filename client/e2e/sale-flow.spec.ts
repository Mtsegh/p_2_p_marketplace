import { expect, test } from "@playwright/test";
import {
  API_URL,
  accept,
  completeHandoff,
  createUser,
  deliverWebhook,
  loginToken,
  loginViaUI,
  propose,
  publishListing,
  reset,
  revealCode,
  secureFunds,
} from "./helpers";

test.beforeEach(() => reset());

test("sale: proposal, escrow, handoff code, payout and review", async ({
  request,
  browser,
}) => {
  const seller = createUser({ verified: true, onboarded: true });
  const buyer = createUser({ verified: true });
  const sellerToken = await loginToken(request, seller.email);
  const buyerToken = await loginToken(request, buyer.email);

  const listingId = await publishListing(request, sellerToken);
  const dealId = await propose(request, buyerToken, listingId);
  await accept(request, sellerToken, dealId);
  await secureFunds(request, buyerToken, dealId);

  // Buyer sees the secured-funds state and reveals the one-time code.
  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await loginViaUI(buyerPage, buyer.email);
  await buyerPage.goto(`/deals/${dealId}`);
  await expect(buyerPage.getByText("Funds secured")).toBeVisible();
  await buyerPage.getByRole("button", { name: "Reveal handoff code" }).click();
  const code = (await buyerPage.locator("p.font-mono").innerText()).trim();
  expect(code).toMatch(/^\d{3} \d{3}$/);

  // Seller enters the code to complete the deal and release funds.
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await loginViaUI(sellerPage, seller.email);
  await sellerPage.goto(`/deals/${dealId}`);
  await sellerPage.getByLabel("Handoff code").fill(code);
  await sellerPage.getByRole("button", { name: "Complete deal" }).click();
  await expect(sellerPage.getByText("Rate this deal")).toBeVisible();

  const dealResponse = await request.get(`${API_URL}/api/v1/deals/${dealId}`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  expect(dealResponse.status()).toBe(200);
  const deal = (await dealResponse.json()) as {
    data: { deal: { status: string } };
  };
  expect(deal.data.deal.status).toBe("COMPLETED");

  // Either party may review after completion.
  await sellerPage.getByRole("button", { name: "4 stars" }).click();
  await sellerPage.getByRole("button", { name: "Submit review" }).click();
  await expect(sellerPage.getByText("Thanks for your review")).toBeVisible();

  await buyerContext.close();
  await sellerContext.close();
});

test("a wrong handoff code is rejected without completing the deal", async ({
  request,
}) => {
  const seller = createUser({ verified: true, onboarded: true });
  const buyer = createUser({ verified: true });
  const sellerToken = await loginToken(request, seller.email);
  const buyerToken = await loginToken(request, buyer.email);

  const listingId = await publishListing(request, sellerToken);
  const dealId = await propose(request, buyerToken, listingId);
  await accept(request, sellerToken, dealId);
  await secureFunds(request, buyerToken, dealId);

  const code = await revealCode(request, buyerToken, dealId);
  expect(await completeHandoff(request, sellerToken, dealId, "000 000")).toBe(
    400,
  );

  const dealResponse = await request.get(`${API_URL}/api/v1/deals/${dealId}`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  const deal = (await dealResponse.json()) as {
    data: { deal: { status: string } };
  };
  expect(deal.data.deal.status).toBe("PAYMENT_PENDING");

  expect(await completeHandoff(request, sellerToken, dealId, code)).toBe(200);
});

test("a replayed payment webhook changes nothing on the second delivery", async ({
  request,
}) => {
  const seller = createUser({ verified: true, onboarded: true });
  const buyer = createUser({ verified: true });
  const sellerToken = await loginToken(request, seller.email);
  const buyerToken = await loginToken(request, buyer.email);

  const listingId = await publishListing(request, sellerToken);
  const dealId = await propose(request, buyerToken, listingId);
  await accept(request, sellerToken, dealId);

  // Checkout only; the webhook is delivered explicitly below.
  const checkout = await request.post(`${API_URL}/api/v1/payments/checkout`, {
    headers: {
      Authorization: `Bearer ${buyerToken}`,
      Origin: "http://localhost:3000",
    },
    data: { dealId },
  });
  expect(checkout.status()).toBe(201);
  const checkoutBody = (await checkout.json()) as {
    data: { checkoutUrl: string };
  };
  const providerPaymentId = checkoutBody.data.checkoutUrl.split("/").at(-1)!;

  const eventId = `evt_e2e_${dealId}`;
  const first = await deliverWebhook(request, eventId, providerPaymentId);
  const second = await deliverWebhook(request, eventId, providerPaymentId);

  expect(first.status).toBe(200);
  expect(first.body.changed).toBe(true);
  expect(second.status).toBe(200);
  expect(second.body.alreadyProcessed).toBe(true);
  expect(second.body.changed).toBe(false);
});
