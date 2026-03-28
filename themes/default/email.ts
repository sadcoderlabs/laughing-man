import type { IssueProps } from "../../src/types.js";
import { escapeHtml } from "./escape.js";

export function EmailPage({ title, issue, content, config }: IssueProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <style>body,table,td{font-family:Arial,Helvetica,sans-serif!important}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;padding:32px 24px;">
          <!-- Header -->
          <tr>
            <td style="border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:32px;">
              <a href="${escapeHtml(config.url)}" style="font-weight:600;font-size:16px;color:#1a1a1a;text-decoration:none;letter-spacing:0.02em;">${escapeHtml(config.name)}</a>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding-top:32px;">
              <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Issue #${issue}</p>
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding-top:24px;margin-top:32px;">
              <p style="font-size:13px;color:#6b7280;text-align:center;margin:0;">
                You're receiving this because you subscribed to ${escapeHtml(config.name)}.
                <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#2563eb;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
