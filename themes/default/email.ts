import mjml2html from "mjml";
import type { IssueProps } from "../../src/types.js";
import { escapeHtml } from "./escape.js";

const EMAIL_BODY_WIDTH = 680;

function stripFirstHeading(html: string): string {
  return html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

export function EmailPage({ title, issue, content, config }: IssueProps): string {
  const escapedTitle = escapeHtml(title);
  const name = escapeHtml(config.name);
  const url = escapeHtml(config.url);
  const bodyContent = stripFirstHeading(content);

  const mjml = `
<mjml>
  <mj-head>
    <mj-title>${escapedTitle}</mj-title>
    <mj-preview>${escapedTitle} — Issue #${issue}</mj-preview>
    <mj-attributes>
      <mj-all font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" color="#1e2d3d" />
      <mj-text line-height="1.75" font-size="16px" padding="0" />
      <mj-section padding="0 16px" />
    </mj-attributes>
    <mj-style inline="inline">
      .issue-card {
        border: 1px solid rgba(0, 85, 119, 0.12);
        border-radius: 24px;
        background: #fafbfc;
      }
      .issue-body {
        font-size: 18px;
        line-height: 1.75;
        color: #1e2d3d;
      }
      .issue-body p,
      .issue-body ul,
      .issue-body ol,
      .issue-body blockquote,
      .issue-body pre,
      .issue-body table {
        margin: 0 0 20px;
      }
      .issue-body h2 {
        margin: 40px 0 12px;
        font-size: 30px;
        line-height: 1.2;
        font-weight: 700;
        color: #0c6b8e;
      }
      .issue-body h3 {
        margin: 32px 0 10px;
        font-size: 24px;
        line-height: 1.3;
        font-weight: 600;
        color: #29556d;
      }
      .issue-body a {
        color: #005577;
        text-decoration: underline;
      }
      .issue-body ul,
      .issue-body ol {
        padding-left: 24px;
      }
      .issue-body li {
        margin-bottom: 8px;
      }
      .issue-body img {
        max-width: 100%;
        height: auto;
        border-radius: 12px;
        border: 1px solid rgba(0, 85, 119, 0.12);
      }
      .issue-body iframe {
        width: 100%;
        aspect-ratio: 16 / 9;
        border: 1px solid rgba(0, 85, 119, 0.12);
        border-radius: 12px;
      }
      .issue-body blockquote {
        margin: 24px 0;
        padding: 4px 0 4px 18px;
        border-left: 2px solid #8a93a0;
        color: #607080;
      }
      .issue-body code {
        font-family: 'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace;
        font-size: 0.9em;
      }
      .issue-body pre {
        overflow-x: auto;
        padding: 20px;
        border-radius: 12px;
        background: #1e2d3d;
        color: #e0e6ed;
      }
      .issue-body pre code {
        color: inherit;
      }
      .issue-body hr {
        border: 0;
        border-top: 1px dashed rgba(0, 85, 119, 0.18);
        margin: 32px 0;
      }
      .issue-body table {
        width: 100%;
        border-collapse: collapse;
      }
      .issue-body th,
      .issue-body td {
        padding: 12px 8px;
        border-bottom: 1px solid rgba(0, 85, 119, 0.18);
        text-align: left;
      }
      .issue-body th {
        font-size: 13px;
        font-weight: 600;
        color: #607080;
      }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f5f6f8" width="${EMAIL_BODY_WIDTH}px">
    <mj-section padding="32px 16px 0">
      <mj-column>
        <mj-text align="center" padding="0 0 18px">
          <a href="${url}" style="font-family:'IBM Plex Mono','SFMono-Regular',Menlo,monospace;font-size:13px;letter-spacing:0.12em;color:#1e2d3d;text-decoration:none;">${name}</a>
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section padding="8px 16px 0">
      <mj-column>
        <mj-text align="center" padding="0 0 16px">
          <span style="display:inline-block;width:92px;height:92px;line-height:92px;text-align:center;border:3px solid #005577;border-radius:999px;color:#005577;font-family:'IBM Plex Mono','SFMono-Regular',Menlo,monospace;font-size:24px;font-weight:600;letter-spacing:0.08em;">LM</span>
        </mj-text>
        <mj-text align="center" padding="0 0 12px" font-size="13px" color="#607080" font-family="'IBM Plex Mono','SFMono-Regular',Menlo,monospace" letter-spacing="2px">
          Issue #${issue}
        </mj-text>
        <mj-text align="center" padding="0 12px 28px" font-size="44px" line-height="1.1" font-weight="700" color="#1e2d3d">
          ${escapedTitle}
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section padding="0 16px">
      <mj-column css-class="issue-card">
        <mj-text padding="24px 24px 0">
          <div style="height:1px;width:112px;margin:0 auto 24px;background:rgba(0,85,119,0.18);"></div>
          <div class="issue-body">${bodyContent}</div>
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section padding="28px 16px 32px">
      <mj-column>
        <mj-text font-size="13px" color="#607080" align="center" padding="0">
          You're receiving this because you subscribed to ${name}.
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#005577;">Unsubscribe</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const { html, errors } = mjml2html(mjml);
  if (errors.length > 0) {
    throw new Error(`MJML compilation errors: ${errors.map((e) => e.message).join(", ")}`);
  }
  return html;
}
