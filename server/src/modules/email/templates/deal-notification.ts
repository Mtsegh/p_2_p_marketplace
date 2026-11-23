import type { EmailMessage } from "../email.types.js";

export interface DealNotification {
  subject: string;
  heading: string;
  paragraphs: string[];
  actionLabel: string;
  footnote?: string;
}

/** Renders a notification email that points the recipient at the deal page. */
export function dealEmail(
  notification: DealNotification,
  dealUrl: string,
): EmailMessage {
  const text = [
    notification.heading,
    "",
    ...notification.paragraphs,
    "",
    `View the deal: ${dealUrl}`,
    ...(notification.footnote ? ["", notification.footnote] : []),
  ].join("\n");

  const html = renderSimpleHtml(notification, dealUrl);

  return { to: "", subject: notification.subject, html, text };
}

/** Simple inline-styled HTML table matching the transactional layout rules. */
function renderSimpleHtml(notification: DealNotification, dealUrl: string): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const paragraphs = notification.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#334155;">${escape(text)}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escape(notification.heading)}</title></head>
  <body style="margin:0;padding:0;background:#f1f5f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:32px;">
          <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">P2P Marketplace</p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">${escape(notification.heading)}</h1>
            ${paragraphs}
            <a href="${escape(dealUrl)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;background:#0f172a;border-radius:8px;text-decoration:none;">${escape(notification.actionLabel)}</a>
            ${notification.footnote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;">${escape(notification.footnote)}</p>` : ""}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
