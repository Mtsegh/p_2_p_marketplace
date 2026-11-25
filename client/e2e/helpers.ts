import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000";
export const CLIENT_URL = process.env.E2E_CLIENT_URL ?? "http://localhost:3000";
export const WEBHOOK_SECRET =
  process.env.E2E_WEBHOOK_SECRET ?? "e2e-webhook-secret-change-me";

const PASSWORD = "e2e-password-123";
const TEST_DB =
  process.env.TEST_DATABASE_URL ??
  "postgresql://marketplace:marketplace@localhost:5432/marketplace_test";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "../../server");

export interface E2EUser {
  id: string;
  email: string;
  password: string;
}

/** Runs the server-side seed helper in the server workspace. */
function seed(...args: string[]): string {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";

  return execFileSync(npx, ["tsx", "e2e/seed.mts", ...args], {
    cwd: serverRoot,
    env: { ...process.env, TEST_DATABASE_URL: TEST_DB },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** Clears the test database and Redis before each test. */
export function reset(): void {
  seed("reset");
}

/** Creates a verified user directly in the test database (no auth backdoor). */
export function createUser(
  options: { verified?: boolean; onboarded?: boolean; admin?: boolean } = {},
): E2EUser {
  const email = `e2e-${randomUUID()}@example.com`;
  const output = seed(
    "create-user",
    email,
    PASSWORD,
    String(options.verified ?? true),
    String(options.onboarded ?? true),
    String(options.admin ?? false),
  );

  return { id: (JSON.parse(output) as { id: string }).id, email, password: PASSWORD };
}

/** Signs in through the API and returns an access token for API calls. */
export async function loginToken(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const response = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
  });

  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as { data: { accessToken: string } }).data
    .accessToken;
}

/** Signs in through the browser UI so client-side auth state is populated. */
export async function loginViaUI(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/profile/);
}

function authHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Origin: CLIENT_URL,
  };
}

/** Creates and publishes a listing via the API. */
export async function publishListing(
  request: APIRequestContext,
  token: string,
  title = "E2E camera",
  listingType: "SALE" | "EXCHANGE" | "BOTH" = "SALE",
): Promise<string> {
  const created = await request.post(`${API_URL}/api/v1/listings`, {
    headers: authHeader(token),
    data: {
      title,
      description: "An item for end-to-end testing",
      location: "Lagos",
      priceCents: listingType === "EXCHANGE" ? undefined : 10_000,
      listingType,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = ((await created.json()) as { data: { listing: { id: string } } })
    .data.listing.id;

  const published = await request.post(
    `${API_URL}/api/v1/listings/${id}/publish`,
    { headers: authHeader(token), data: {} },
  );
  expect(published.status(), await published.text()).toBe(200);

  return id;
}

/** Creates an exchange proposal with one of the buyer's own listings. */
export async function proposeSwap(
  request: APIRequestContext,
  token: string,
  listingId: string,
  offeredListingIds: string[],
): Promise<string> {
  const response = await request.post(`${API_URL}/api/v1/deals/exchange`, {
    headers: authHeader(token),
    data: { listingId, offeredListingIds },
  });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { data: { deal: { id: string } } }).data
    .deal.id;
}

export async function propose(
  request: APIRequestContext,
  token: string,
  listingId: string,
): Promise<string> {
  const response = await request.post(`${API_URL}/api/v1/deals`, {
    headers: authHeader(token),
    data: { listingId, amountCents: 10_000 },
  });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { data: { deal: { id: string } } }).data
    .deal.id;
}

export async function accept(
  request: APIRequestContext,
  token: string,
  dealId: string,
): Promise<void> {
  const response = await request.post(
    `${API_URL}/api/v1/deals/${dealId}/accept`,
    { headers: authHeader(token), data: {} },
  );
  expect(response.status(), await response.text()).toBe(200);
}

/** Starts checkout and delivers a signed payment.succeeded webhook event. */
export async function secureFunds(
  request: APIRequestContext,
  buyerToken: string,
  dealId: string,
  eventId = `evt_${randomUUID()}`,
): Promise<void> {
  const checkout = await request.post(`${API_URL}/api/v1/payments/checkout`, {
    headers: authHeader(buyerToken),
    data: { dealId },
  });
  expect(checkout.status(), await checkout.text()).toBe(201);

  const payment = ((await checkout.json()) as {
    data: { checkoutUrl: string };
  }).data.checkoutUrl.split("/").at(-1)!;
  const providerPaymentId = payment.startsWith("test_pay_")
    ? payment
    : `test_pay_${dealId}`;

  await deliverWebhook(request, eventId, providerPaymentId);
}

export async function deliverWebhook(
  request: APIRequestContext,
  eventId: string,
  providerPaymentId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = {
    id: eventId,
    type: "payment.succeeded",
    data: { providerPaymentId },
  };
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");

  const response = await request.post(`${API_URL}/api/v1/payments/webhook`, {
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": signature,
    },
    data: raw,
  });

  return { status: response.status(), body: (await response.json()) as Record<string, unknown> };
}

export async function revealCode(
  request: APIRequestContext,
  token: string,
  dealId: string,
): Promise<string> {
  const response = await request.post(
    `${API_URL}/api/v1/deals/${dealId}/handoff/reveal`,
    { headers: authHeader(token), data: {} },
  );
  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as { data: { code: string } }).data.code;
}

export async function completeHandoff(
  request: APIRequestContext,
  token: string,
  dealId: string,
  code: string,
): Promise<number> {
  const response = await request.post(
    `${API_URL}/api/v1/deals/${dealId}/handoff/complete`,
    { headers: authHeader(token), data: { code } },
  );
  return response.status();
}
