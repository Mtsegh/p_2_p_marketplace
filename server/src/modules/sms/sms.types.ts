/**
 * One outbound SMS message. Providers receive this and are responsible only
 * for delivery; choosing recipients, building the body, and rendering the
 * content happen before the provider is called.
 */
export interface SmsMessage {
  to: string;
  body: string;
}

/**
 * Delivery boundary. Swapping the SMS vendor means adding one implementation
 * and changing `SMS_PROVIDER`; nothing else in the codebase talks to a vendor
 * directly.
 */
export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}
