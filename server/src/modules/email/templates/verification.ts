import { renderEmailLayout } from "./layout.js";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function verificationEmail({
  url,
  expiresInHours,
}: {
  url: string;
  expiresInHours: number;
}): RenderedEmail {
  const subject = "Confirm your email address";

  const text = [
    "Confirm your email address",
    "",
    "Open the link below to confirm this address for your P2P Marketplace account:",
    "",
    url,
    "",
    `The link works for ${expiresInHours} hours and can be used once.`,
    "",
    "If you did not create an account, you can ignore this email.",
  ].join("\n");

  const html = renderEmailLayout({
    preheader: "Confirm your email address to finish setting up your account.",
    heading: "Confirm your email address",
    paragraphs: [
      "Open the link below to confirm this address for your P2P Marketplace account.",
      `The link works for ${expiresInHours} hours and can be used once.`,
    ],
    action: { label: "Confirm email address", url },
    footnote:
      "If you did not create an account, you can ignore this email and nothing will change.",
  });

  return { subject, html, text };
}
