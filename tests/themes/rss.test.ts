import { describe, expect, it } from "bun:test";
import { generateRssFeed } from "../../themes/default/rss";
import type { SiteConfig, IssueData } from "../../src/types";

function makeConfig(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    name: "Test Newsletter",
    description: "A newsletter by [Vinta](https://vinta.ws)",
    url: "https://example.com",
    issues_dir: "/tmp/issues",
    web_hosting: { provider: "cloudflare-pages", project: "test" },
    email_hosting: { provider: "resend", from: "test@example.com" },
    env: {},
    configDir: "/tmp",
    ...overrides,
  };
}

function makeIssue(overrides: Partial<IssueData> = {}): IssueData {
  return {
    issue: 1,
    status: "ready",
    title: "First Issue",
    date: "2026-03-15",
    filePath: "/tmp/issues/01.md",
    rawContent: "Hello world",
    html: "<p>Hello world</p>",
    ...overrides,
  };
}

describe("generateRssFeed", () => {
  it("generates valid RSS 2.0 XML with required namespaces", () => {
    const config = makeConfig();
    const issues = [makeIssue()];
    const rss = generateRssFeed({ config, issues });

    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain("xmlns:atom=");
    expect(rss).toContain('xmlns:content="http://purl.org/rss/1.0/modules/content/"');
    expect(rss).toContain("</rss>");
  });

  it("includes required channel elements", () => {
    const config = makeConfig();
    const rss = generateRssFeed({ config, issues: [makeIssue()] });

    expect(rss).toContain("<title>Test Newsletter</title>");
    expect(rss).toContain("<link>https://example.com/</link>");
  });

  it("includes generator and docs elements", () => {
    const config = makeConfig();
    const rss = generateRssFeed({ config, issues: [makeIssue()] });

    expect(rss).toContain("<generator>laughing-man</generator>");
    expect(rss).toContain("<docs>https://cyber.harvard.edu/rss/rss.html</docs>");
  });

  it("includes a channel image that points to a fetchable favicon", () => {
    const config = makeConfig();
    const rss = generateRssFeed({ config, issues: [makeIssue()] });

    expect(rss).toContain("<image>");
    expect(rss).toContain("<url>https://example.com/favicon.svg</url>");
    expect(rss).toContain("<title>Test Newsletter</title>");
    expect(rss).toContain("<link>https://example.com/</link>");
  });

  it("strips markdown from channel description", () => {
    const config = makeConfig({ description: "A newsletter by [Vinta](https://vinta.ws)" });
    const rss = generateRssFeed({ config, issues: [makeIssue()] });

    expect(rss).toContain("<description>A newsletter by Vinta</description>");
    expect(rss).not.toContain("[Vinta]");
  });

  it("includes atom:link self-reference", () => {
    const config = makeConfig();
    const rss = generateRssFeed({ config, issues: [makeIssue()] });

    expect(rss).toContain('href="https://example.com/feed.xml"');
    expect(rss).toContain('rel="self"');
    expect(rss).toContain('type="application/rss+xml"');
  });

  it("uses plain-text excerpt in <description> and full HTML in <content:encoded>", () => {
    const config = makeConfig();
    const issues = [makeIssue({
      rawContent: "# Title\n\nThis is the **body** of the post.",
      html: "<h1>Title</h1>\n<p>This is the <strong>body</strong> of the post.</p>",
    })];
    const rss = generateRssFeed({ config, issues });

    // <description> should contain plain-text excerpt (XML-escaped)
    expect(rss).toMatch(/<description>[^<]*body[^<]*<\/description>/);
    // <content:encoded> should contain full HTML in CDATA
    expect(rss).toContain("<content:encoded><![CDATA[");
    expect(rss).toContain("<strong>body</strong>");
    expect(rss).toContain("]]></content:encoded>");
  });

  it("wraps HTML content in CDATA sections", () => {
    const config = makeConfig();
    const issues = [makeIssue({ html: "<p>Hello <strong>world</strong></p>" })];
    const rss = generateRssFeed({ config, issues });

    expect(rss).toContain("<![CDATA[<p>Hello <strong>world</strong></p>]]>");
  });

  it("handles ]]> in HTML content safely", () => {
    const config = makeConfig();
    const issues = [makeIssue({ html: "<code>if (a[b]]>c)</code>" })];
    const rss = generateRssFeed({ config, issues });

    // Should split CDATA to avoid premature close: ]]> becomes ]]]]><![CDATA[>
    expect(rss).toContain("]]]]><![CDATA[>");
    // The original ]]> sequence should NOT appear verbatim inside a CDATA block
    expect(rss).not.toContain("<![CDATA[<code>if (a[b]]>c)</code>]]>");
  });

  it("generates items for ready issues with dates", () => {
    const config = makeConfig();
    const issues = [
      makeIssue({ issue: 1, title: "First", date: "2026-03-01" }),
      makeIssue({ issue: 2, title: "Second", date: "2026-03-15" }),
    ];
    const rss = generateRssFeed({ config, issues });

    expect(rss).toContain("<title>First</title>");
    expect(rss).toContain("<title>Second</title>");
    expect(rss).toContain("https://example.com/issues/1/");
    expect(rss).toContain("https://example.com/issues/2/");
  });

  it("sorts items newest first by publication date", () => {
    const config = makeConfig();
    const issues = [
      makeIssue({ issue: 11, title: "Older by date", date: "2026-03-01" }),
      makeIssue({ issue: 10, title: "Newer by date", date: "2026-03-15" }),
    ];
    const rss = generateRssFeed({ config, issues });

    const newerPos = rss.indexOf("Newer by date");
    const olderPos = rss.indexOf("Older by date");
    expect(newerPos).toBeLessThan(olderPos);
  });

  it("uses the most recent publication date for lastBuildDate", () => {
    const config = makeConfig();
    const issues = [
      makeIssue({ issue: 11, title: "Older by date", date: "2026-02-01" }),
      makeIssue({ issue: 10, title: "Newer by date", date: "2026-03-01" }),
    ];
    const rss = generateRssFeed({ config, issues });

    expect(rss).toContain("<lastBuildDate>Sun, 01 Mar 2026 12:00:00 GMT</lastBuildDate>");
  });

  it("excludes draft issues", () => {
    const config = makeConfig();
    const issues = [
      makeIssue({ issue: 1, status: "ready", date: "2026-03-01" }),
      makeIssue({ issue: 2, status: "draft", title: "Draft Issue" }),
    ];
    const rss = generateRssFeed({ config, issues });

    expect(rss).not.toContain("Draft Issue");
  });

  it("excludes issues without dates", () => {
    const config = makeConfig();
    const issues = [
      makeIssue({ issue: 1, status: "ready", date: "2026-03-01" }),
      makeIssue({ issue: 2, status: "ready", title: "No Date", date: undefined }),
    ];
    const rss = generateRssFeed({ config, issues });

    expect(rss).not.toContain("No Date");
  });

  it("limits feed to 50 items", () => {
    const config = makeConfig();
    const issues = Array.from({ length: 60 }, (_, i) =>
      makeIssue({
        issue: i + 1,
        title: `Issue ${i + 1}`,
        date: `2026-01-${String(Math.min(i + 1, 28)).padStart(2, "0")}`,
      }),
    );
    const rss = generateRssFeed({ config, issues });

    const itemCount = (rss.match(/<item>/g) ?? []).length;
    expect(itemCount).toBe(50);
  });

  it("sets guid with isPermaLink=true", () => {
    const config = makeConfig();
    const rss = generateRssFeed({ config, issues: [makeIssue()] });

    expect(rss).toContain('isPermaLink="true"');
    expect(rss).toContain("https://example.com/issues/1/</guid>");
  });

  it("produces valid pubDate in RFC 822 format", () => {
    const config = makeConfig();
    const rss = generateRssFeed({ config, issues: [makeIssue({ date: "2026-03-15" })] });

    // RFC 822 format from toUTCString(): "Sun, 15 Mar 2026 12:00:00 GMT"
    expect(rss).toMatch(/<pubDate>\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT<\/pubDate>/);
  });

  it("handles empty issues list", () => {
    const config = makeConfig();
    const rss = generateRssFeed({ config, issues: [] });

    expect(rss).toContain("<channel>");
    expect(rss).toContain("</channel>");
    expect(rss).not.toContain("<item>");
  });

  it("escapes special XML characters in titles", () => {
    const config = makeConfig();
    const issues = [makeIssue({ title: 'Issues & "Problems" <solved>' })];
    const rss = generateRssFeed({ config, issues });

    expect(rss).toContain("Issues &amp; &quot;Problems&quot; &lt;solved&gt;");
  });

  it("uses config name as fallback when no description", () => {
    const config = makeConfig({ description: undefined });
    const rss = generateRssFeed({ config, issues: [makeIssue()] });

    expect(rss).toContain("<description>Test Newsletter</description>");
  });

  it("uses absolute URLs for all links", () => {
    const config = makeConfig();
    const rss = generateRssFeed({ config, issues: [makeIssue()] });

    // Every <link> and <guid> should be absolute (https://)
    const links = rss.match(/<link>[^<]+<\/link>/g) ?? [];
    const guids = rss.match(/<guid[^>]*>[^<]+<\/guid>/g) ?? [];
    for (const link of [...links, ...guids]) {
      const url = link.replace(/<[^>]+>/g, "");
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it("absolutizes relative URLs in content:encoded", () => {
    const config = makeConfig();
    const issues = [makeIssue({
      issue: 7,
      html: '<p><a href="./notes">Notes</a><img src="/issues/7/assets/cover.jpg" alt="Cover"><a href="#footnote">Footnote</a></p>',
    })];
    const rss = generateRssFeed({ config, issues });

    expect(rss).toContain('href="https://example.com/issues/7/notes"');
    expect(rss).toContain('src="https://example.com/issues/7/assets/cover.jpg"');
    expect(rss).toContain('href="https://example.com/issues/7/#footnote"');
  });
});
