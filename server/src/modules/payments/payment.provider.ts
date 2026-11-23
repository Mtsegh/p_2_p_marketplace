/**
 * Boundary for payment gateways. The API never handles raw card data: the
 * client uses hosted checkout, and the gateway calls our webhook as the source
 * of truth for payment state. Implementations are swappable via one factory.
 *
 * All amounts are integer minor units (cents) with an explicit currency.
 */
export interface PaymentIntent {
  /** Gateway's id for the payment, stored on the transaction. */
  providerPaymentId: string;
  /** URL the buyer is redirected to for hosted checkout. */
  checkoutUrl: string;
  /** Amount that will be charged, in cents. */
  amountCents: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;

  createPayment(input: {
    amountCents: number;
    currency: string;
    description: string;
    /** Stable key so retries never create duplicate charges. */
    idempotencyKey: string;
  }): Promise<PaymentIntent>;

  capture(providerPaymentId: string): Promise<void>;
  refund(providerPaymentId: string, amountCents?: number): Promise<void>;
  payout(destination: string, amountCents: number): Promise<string>;
}

/**
 * Deterministic test provider. It creates a fake checkout URL and a predictable
 * payment id derived from the idempotency key, so retries are stable. Webhooks
 * are simulated by calling the webhook endpoint with a signed payload.
 */
export const testPaymentProvider: PaymentProvider = {
  name: "test",

  async createPayment({ amountCents, currency, idempotencyKey }) {
    return {
      providerPaymentId: `test_pay_${idempotencyKey}`,
      checkoutUrl: `https://checkout.test/pay/test_pay_${idempotencyKey}`,
      amountCents,
      currency,
    };
  },

  async capture() {},
  async refund() {},
  async payout() {
    return "test_payout";
  },
};
