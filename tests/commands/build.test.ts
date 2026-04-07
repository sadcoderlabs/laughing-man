import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { runBuild } from "../../src/commands/build";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import os from "node:os";

describe("runBuild", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-build-test-"));
    mkdirSync(join(tmpDir, "issues"), { recursive: true });

    const config = `
name: "Test Newsletter"
issues_dir: ./issues
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), config);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates index.html, 404.html, and issue pages", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    expect(existsSync(join(tmpDir, "output", "website", "index.html"))).toBe(
      true,
    );
    expect(existsSync(join(tmpDir, "output", "website", "404.html"))).toBe(
      true,
    );
    expect(
      existsSync(
        join(tmpDir, "output", "website", "issues", "1", "index.html"),
      ),
    ).toBe(true);
    expect(existsSync(join(tmpDir, "output", "email", "1.html"))).toBe(true);
  });

  it("excludes draft issues from build output", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nReady.\n",
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-2.md"),
      "---\nissue: 2\nstatus: draft\n---\n# Issue Two\n\nDraft.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    expect(
      existsSync(
        join(tmpDir, "output", "website", "issues", "1", "index.html"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(tmpDir, "output", "website", "issues", "2", "index.html"),
      ),
    ).toBe(false);
    expect(existsSync(join(tmpDir, "output", "email", "1.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "email", "2.html"))).toBe(false);
  });

  it("includes draft issues when includeDrafts is true", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: draft\n---\n# Draft Issue\n\nWIP.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: true });

    expect(
      existsSync(
        join(tmpDir, "output", "website", "issues", "1", "index.html"),
      ),
    ).toBe(true);
    expect(existsSync(join(tmpDir, "output", "email", "1.html"))).toBe(true);
  });

  it("supports writing preview builds to a separate output directory", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: draft\n---\n# Draft Issue\n\nWIP.\n",
    );

    await runBuild({
      configDir: tmpDir,
      includeDrafts: true,
      outputDirName: "preview",
    });

    expect(
      existsSync(
        join(tmpDir, "preview", "website", "issues", "1", "index.html"),
      ),
    ).toBe(true);
    expect(existsSync(join(tmpDir, "preview", "email", "1.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "website", "index.html"))).toBe(
      false,
    );
  });

  it("throws on duplicate issue numbers", async () => {
    writeFileSync(
      join(tmpDir, "issues", "a.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue A\n",
    );
    writeFileSync(
      join(tmpDir, "issues", "b.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue B\n",
    );

    await expect(
      runBuild({ configDir: tmpDir, includeDrafts: false }),
    ).rejects.toThrow("Duplicate issue number 1");
  });

  it("index.html contains issue titles", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Hello World\n\nContent.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    const issueHtml = readFileSync(
      join(tmpDir, "output", "website", "issues", "1", "index.html"),
      "utf8",
    );
    expect(indexHtml).toContain("Hello World");
    expect(indexHtml).toMatch(/href="\/assets\/styles\.[0-9a-f]{10}\.css"/);
    expect(indexHtml).toMatch(/<script src="\/assets\/subscribe\.[0-9a-f]{10}\.js" defer><\/script>/);
    expect(indexHtml).not.toContain("<style>:root");
    expect(indexHtml).not.toContain("const subscribeSection = document.getElementById");
    expect(issueHtml).toMatch(/<script src="\/assets\/subscribe\.[0-9a-f]{10}\.js" defer><\/script>/);
    expect(issueHtml).not.toContain("const subscribeSection = document.getElementById");
  });

  it("includes laughing-man credit in generated website footers", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Hello World\n\nContent.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    const issueHtml = readFileSync(
      join(tmpDir, "output", "website", "issues", "1", "index.html"),
      "utf8",
    );

    expect(indexHtml).toContain("Created with");
    expect(indexHtml).toContain(
      'href="https://github.com/sadcoderlabs/laughing-man"',
    );
    expect(issueHtml).toContain("Created with");
    expect(issueHtml).toContain(
      'href="https://github.com/sadcoderlabs/laughing-man"',
    );
  });

  it("generates _routes.json that routes only /api/* through Functions", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Hello World\n\nContent.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const routes = JSON.parse(
      readFileSync(join(tmpDir, "output", "website", "_routes.json"), "utf8"),
    );
    expect(routes).toEqual({
      version: 1,
      include: ["/api/*"],
      exclude: [],
    });
  });

  it("generates _headers with security headers for static assets", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Hello World\n\nContent.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const headers = readFileSync(
      join(tmpDir, "output", "website", "_headers"),
      "utf8",
    );
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("Referrer-Policy: strict-origin-when-cross-origin");
  });

  it("copies favicon files and links to them from generated pages", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Hello World\n\nContent.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    expect(existsSync(join(tmpDir, "output", "website", "favicon.svg"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "website", "favicon.ico"))).toBe(true);

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    expect(indexHtml).toContain('href="/favicon.ico" sizes="32x32"');
    expect(indexHtml).toContain('href="/favicon.svg"');
  });

  it("writes hashed stylesheet and subscribe assets and marks them immutable", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Hello World\n\nContent.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const assetsFiles = readdirSync(join(tmpDir, "output", "website", "assets"));
    const stylesheetFile = assetsFiles.find((name) => /^styles\.[0-9a-f]{10}\.css$/.test(name));
    const subscribeScriptFile = assetsFiles.find((name) => /^subscribe\.[0-9a-f]{10}\.js$/.test(name));

    expect(stylesheetFile).toBeDefined();
    expect(subscribeScriptFile).toBeDefined();

    const headers = readFileSync(
      join(tmpDir, "output", "website", "_headers"),
      "utf8",
    );
    expect(headers).toContain(`/assets/${stylesheetFile}`);
    expect(headers).toContain(`/assets/${subscribeScriptFile}`);
    expect(headers).toContain("Cache-Control: public, max-age=31536000, immutable");
  });

  it("404.html uses general recovery copy and links back into the site", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Hello World\n\nContent.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const notFoundHtml = readFileSync(
      join(tmpDir, "output", "website", "404.html"),
      "utf8",
    );
    expect(notFoundHtml).toContain("Page not found");
    expect(notFoundHtml).toContain("Go to homepage");
    expect(notFoundHtml).toContain('href="/"');
  });

  it("production build shows coming-soon teasers for draft issues", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n",
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-2.md"),
      "---\nissue: 2\nstatus: draft\n---\n# Draft Two\n\nWIP.\n",
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-3.md"),
      "---\nissue: 3\nstatus: draft\n---\n# Draft Three\n\nWIP.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    expect(indexHtml).toContain("Issue #03 coming soon");
    expect(indexHtml).toContain("Issue #02 coming soon");
    expect(indexHtml).toContain('class="feed-row feed-teaser"');
    // Draft titles must not leak
    expect(indexHtml).not.toContain("Draft Two");
    expect(indexHtml).not.toContain("Draft Three");
    // Draft pages must not exist
    expect(
      existsSync(
        join(tmpDir, "output", "website", "issues", "2", "index.html"),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(tmpDir, "output", "website", "issues", "3", "index.html"),
      ),
    ).toBe(false);
  });

  it("no teasers when there are no drafts", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    expect(indexHtml).not.toContain("coming soon");
    expect(indexHtml).not.toContain('class="feed-row feed-teaser"');
  });

  it("teasers replace empty state when only drafts exist", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: draft\n---\n# Draft Only\n\nWIP.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    expect(indexHtml).toContain("Issue #01 coming soon");
    expect(indexHtml).not.toContain("No published issues yet");
    expect(indexHtml).not.toContain("End of Archives");
  });

  it("index.html contains WebSite JSON-LD", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    expect(indexHtml).toContain('<script type="application/ld+json">');
    expect(indexHtml).toContain('"@type": "WebSite"');
    expect(indexHtml).toContain('"name": "Test Newsletter"');
  });

  it("issue pages contain Article JSON-LD", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello world this is a test.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const issueHtml = readFileSync(
      join(tmpDir, "output", "website", "issues", "1", "index.html"),
      "utf8",
    );
    expect(issueHtml).toContain('<script type="application/ld+json">');
    expect(issueHtml).toContain('"@type": "Article"');
    expect(issueHtml).toContain('"headline": "Issue One"');
    expect(issueHtml).toContain('"datePublished": "2026-03-15"');
    expect(issueHtml).toContain("/assets/cover.png");
  });

  it("generates sitemap.xml with index and issue URLs", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello.\n",
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-2.md"),
      "---\nissue: 2\nstatus: ready\ndate: 2026-03-20\n---\n# Issue Two\n\nWorld.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const sitemap = readFileSync(
      join(tmpDir, "output", "website", "sitemap.xml"),
      "utf8",
    );
    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain("https://my-newsletter.pages.dev/</loc>");
    expect(sitemap).toContain("https://my-newsletter.pages.dev/issues/1/</loc>");
    expect(sitemap).toContain("https://my-newsletter.pages.dev/issues/2/</loc>");
    expect(sitemap).toContain("<lastmod>2026-03-15</lastmod>");
    expect(sitemap).toContain("<lastmod>2026-03-20</lastmod>");
    // Index page lastmod = most recent issue date
    expect(sitemap).toContain(
      "<loc>https://my-newsletter.pages.dev/</loc>\n    <lastmod>2026-03-20</lastmod>",
    );
  });

  it("sitemap.xml excludes draft issues", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello.\n",
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-2.md"),
      "---\nissue: 2\nstatus: draft\n---\n# Issue Two\n\nDraft.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const sitemap = readFileSync(
      join(tmpDir, "output", "website", "sitemap.xml"),
      "utf8",
    );
    expect(sitemap).toContain("issues/1/");
    expect(sitemap).not.toContain("issues/2/");
  });

  it("sitemap.xml with no published issues contains only index", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: draft\n---\n# Draft Only\n\nWIP.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const sitemap = readFileSync(
      join(tmpDir, "output", "website", "sitemap.xml"),
      "utf8",
    );
    expect(sitemap).toContain("https://my-newsletter.pages.dev/</loc>");
    expect(sitemap).not.toContain("/issues/");
  });

  it("generates robots.txt with sitemap reference", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const robots = readFileSync(
      join(tmpDir, "output", "website", "robots.txt"),
      "utf8",
    );
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain(
      "Sitemap: https://my-newsletter.pages.dev/sitemap.xml",
    );
  });

  it("generates feed.xml with absolute published asset URLs and date-based ordering", async () => {
    mkdirSync(join(tmpDir, "attachments"), { recursive: true });
    writeFileSync(join(tmpDir, "attachments", "cover.jpg"), "fake-image-data");
    writeFileSync(
      join(tmpDir, "issues", "issue-10.md"),
      "---\nissue: 10\nstatus: ready\ndate: 2026-03-20\n---\n# Newer by date\n\n![Cover](cover.jpg)\n",
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-11.md"),
      "---\nissue: 11\nstatus: ready\ndate: 2026-03-10\n---\n# Older by date\n\nHello.\n",
    );
    writeFileSync(
      join(tmpDir, "laughing-man.yaml"),
      `
name: "Test Newsletter"
issues_dir: ./issues
attachments_dir: ./attachments
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim(),
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const feed = readFileSync(
      join(tmpDir, "output", "website", "feed.xml"),
      "utf8",
    );
    expect(feed).toContain('src="https://my-newsletter.pages.dev/issues/10/assets/cover.jpg"');
    expect(feed).not.toContain('src="cover.jpg"');
    expect(feed).toContain("<lastBuildDate>Fri, 20 Mar 2026 12:00:00 GMT</lastBuildDate>");
    expect(feed.indexOf("Newer by date")).toBeLessThan(feed.indexOf("Older by date"));
  });

  it("includes author metadata in outputs when author is configured", async () => {
    writeFileSync(
      join(tmpDir, "laughing-man.yaml"),
      `
name: "Test Newsletter"
author:
  name: Jane Doe
  url: https://janedoe.com
  x_handle: janedoe
issues_dir: ./issues
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim(),
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    const issueHtml = readFileSync(
      join(tmpDir, "output", "website", "issues", "1", "index.html"),
      "utf8",
    );
    const feed = readFileSync(
      join(tmpDir, "output", "website", "feed.xml"),
      "utf8",
    );
    const llmsTxt = readFileSync(
      join(tmpDir, "output", "website", "llms.txt"),
      "utf8",
    );
    const notFoundHtml = readFileSync(
      join(tmpDir, "output", "website", "404.html"),
      "utf8",
    );

    // HTML meta author tag
    expect(indexHtml).toContain('<meta name="author" content="Jane Doe">');
    expect(issueHtml).toContain('<meta name="author" content="Jane Doe">');
    expect(notFoundHtml).toContain('<meta name="author" content="Jane Doe">');

    // OG article:author uses URL, only on issue pages
    expect(issueHtml).toContain('<meta property="article:author" content="https://janedoe.com">');
    expect(indexHtml).not.toContain("article:author");

    // twitter:creator on all pages
    expect(issueHtml).toContain('<meta name="twitter:creator" content="@janedoe">');
    expect(indexHtml).toContain('<meta name="twitter:creator" content="@janedoe">');

    // JSON-LD author on index
    expect(indexHtml).toContain('"@type": "Person"');
    expect(indexHtml).toContain('"name": "Jane Doe"');

    // JSON-LD author on issue pages
    expect(issueHtml).toContain('"@type": "Person"');
    expect(issueHtml).toContain('"name": "Jane Doe"');
    expect(issueHtml).toContain('"url": "https://janedoe.com"');

    // RSS managingEditor
    expect(feed).toContain("<managingEditor>Jane Doe</managingEditor>");

    // llms.txt Author section
    expect(llmsTxt).toContain("## Author");
    expect(llmsTxt).toContain("[Jane Doe](https://janedoe.com) ([@janedoe](https://x.com/janedoe))");
  });

  it("omits author metadata when author is not configured", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    const issueHtml = readFileSync(
      join(tmpDir, "output", "website", "issues", "1", "index.html"),
      "utf8",
    );
    const feed = readFileSync(
      join(tmpDir, "output", "website", "feed.xml"),
      "utf8",
    );
    const llmsTxt = readFileSync(
      join(tmpDir, "output", "website", "llms.txt"),
      "utf8",
    );

    expect(indexHtml).not.toContain('name="author"');
    expect(issueHtml).not.toContain('name="author"');
    expect(issueHtml).not.toContain("article:author");
    expect(indexHtml).not.toContain("twitter:creator");
    expect(issueHtml).not.toContain("twitter:creator");
    expect(feed).not.toContain("managingEditor");
    expect(llmsTxt).not.toContain("## Author");
  });

  it("preview mode shows drafts as full entries with no teasers", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n",
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-2.md"),
      "---\nissue: 2\nstatus: draft\n---\n# My Draft Title\n\nWIP.\n",
    );

    await runBuild({ configDir: tmpDir, includeDrafts: true });

    const indexHtml = readFileSync(
      join(tmpDir, "output", "website", "index.html"),
      "utf8",
    );
    // Draft renders as a full entry with its real title
    expect(indexHtml).toContain("My Draft Title");
    expect(indexHtml).toContain("(draft)");
    // No coming-soon teasers
    expect(indexHtml).not.toContain("coming soon");
    expect(indexHtml).not.toContain('class="feed-row feed-teaser"');
  });
});
