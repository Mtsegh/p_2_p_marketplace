import { renderEmailLayout } from "./layout.js";
import type { RenderedEmail } from "./verification.js";

export function emailChangeEmail({
  url,
  newEmail,
  expiresInMinutes,
}: {
  url: string;
  newEmail: string;
  expiresInMinutes: number;
}): RenderedEmail {
  const subject = "Confirm your new email address";

  const text = [
    "Confirm your new email address",
    "",
    `Open the link below to use ${newEmail} to sign in to your P2P Marketplace account:`,
    "",
    url,
    "",
    `The link works for ${expiresInMinutes} minutes and can be used once.`,
    "",
    "If you did not ask for this, ignore this email. Your current address stays on the account and this link will expire.",
  ].join("\n");

  const html = renderEmailLayout({
    preheader: `Confirm ${newEmail} as your new sign-in address.`,
    heading: "Confirm your new email address",
    paragraphs: [
      `Open the link below to use ${newEmail} to sign in to your P2P Marketplace account.`,
      `The link works for ${expiresInMinutes} minutes and can be used once. Until you confirm, keep signing in with your current address.`,
    ],
    action: { label: "Confirm new email", url },
    footnote:
      "If you did not ask for this, ignore this email. Your current address stays on the account and this link will expire.",
  });

  return { subject, html, text };
}
