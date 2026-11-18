/**
 * One outbound transactional email. Providers receive this and are responsible
 * only for delivery; choosing recipients, building links, and rendering the
 * content happen before the provider is called.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text fallback. Never omit it: some clients and filters require it. */
  text: string;
}

/**
 * Delivery boundary. Swapping Brevo for another vendor means adding one
 * implementation and changing `EMAIL_PROVIDER`; nothing else in the codebase
 * talks to a vendor directly.
 */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
