/**
 * Shared HTML shell for transactional email. Email clients are not browsers:
 * layout uses a table, every style is inline, and no external CSS or web fonts
 * are referenced. Widths are capped at 560px so the message reads well in
 * desktop clients and fills mobile screens.
 */
export interface EmailLayoutInput {
  /** Preview text shown next to the subject in most inboxes. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  action: { label: string; url: string };
  footnote?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailLayout({
  preheader,
  heading,
  paragraphs,
  action,
  footnote,
}: EmailLayoutInput): string {
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#334155;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const footnoteBlock = footnote
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;">${escapeHtml(footnote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:32px;">
            <tr>
              <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">P2P Marketplace</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(heading)}</h1>
                ${body}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
                  <tr>
                    <td style="border-radius:8px;background:#0f172a;">
                      <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(action.label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#64748b;">If the button does not work, copy this link into your browser:<br /><a href="${escapeHtml(action.url)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(action.url)}</a></p>
                ${footnoteBlock}
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:16px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Sent by P2P Marketplace. This message was triggered by activity on your account.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
