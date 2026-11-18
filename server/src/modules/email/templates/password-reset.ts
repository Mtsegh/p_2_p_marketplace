import { renderEmailLayout } from "./layout.js";
import type { RenderedEmail } from "./verification.js";

export function passwordResetEmail({
  url,
  expiresInMinutes,
}: {
  url: string;
  expiresInMinutes: number;
}): RenderedEmail {
  const subject = "Reset your password";

  const text = [
    "Reset your password",
    "",
    "Open the link below to choose a new password for your P2P Marketplace account:",
    "",
    url,
    "",
    `The link works for ${expiresInMinutes} minutes and can be used once.`,
    "",
    "If you did not ask for this, ignore the email. Your current password still works, and this link will expire.",
  ].join("\n");

  const html = renderEmailLayout({
    preheader: "Choose a new password for your account.",
    heading: "Reset your password",
    paragraphs: [
      "Open the link below to choose a new password for your P2P Marketplace account.",
      `The link works for ${expiresInMinutes} minutes and can be used once. Changing your password signs out every other device.`,
    ],
    action: { label: "Choose a new password", url },
    footnote:
      "If you did not ask for this, ignore the email. Your current password still works, and this link will expire.",
  });

  return { subject, html, text };
}
