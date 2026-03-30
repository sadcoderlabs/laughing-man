import { describe, expect, it } from "bun:test";
import { EmailPage } from "../../themes/default/email";
import type { SiteConfig } from "../../src/types";

const testConfig: SiteConfig = {
  name: "Test Newsletter",
  description: "A test newsletter",
  url: "https://example.com",
  issues_dir: "/tmp/issues",
  web_hosting: {
    provider: "cloudflare-pages",
    project: "test-newsletter",
  },
  email_hosting: {
    from: "Test <test@example.com>",
    provider: "resend",
  },
  env: {},
  configDir: "/tmp",
};

describe("EmailPage", () => {
  it("returns valid HTML document", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello world</p>",
      config: testConfig,
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("</html>");
  });

  it("contains newsletter name linked to site URL", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello world</p>",
      config: testConfig,
    });

    expect(html).toContain("Test Newsletter");
    expect(html).toContain('href="https://example.com"');
  });

  it("contains issue number", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 42,
      content: "<p>Hello world</p>",
      config: testConfig,
    });

    expect(html).toContain("Issue #42");
  });

  it("links the Read in browser button to the website issue page", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 42,
      content: "<p>Hello world</p>",
      config: testConfig,
    });

    expect(html).toContain("Read in browser");
    expect(html).toContain('href="https://example.com/issues/42/"');
  });

  it("contains rendered content", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<h2>Section</h2><p>Some content here.</p>",
      config: testConfig,
    });

    expect(html).toContain(">Section</h2>");
    expect(html).toContain(">Some content here.</p>");
  });

  it("rejects mj-include tags in rendered content", () => {
    expect(() =>
      EmailPage({
        title: "My First Issue",
        issue: 1,
        content: '<p>Hello</p><mj-include path="/etc/hosts" type="css" />',
        config: testConfig,
      })
    ).toThrow("Email content cannot contain <mj-include>");
  });

  it("contains Resend unsubscribe placeholder", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello</p>",
      config: testConfig,
    });

    expect(html).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
  });

  it("contains MSO conditional comments for Outlook", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello</p>",
      config: testConfig,
    });

    expect(html).toContain("<!--[if mso");
  });

  it("uses table-based layout for email client compatibility", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello</p>",
      config: testConfig,
    });

    expect(html).toContain("<table");
    expect(html).toContain("</table>");
  });

  it("uses a wider desktop reading width while staying responsive", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello</p>",
      config: testConfig,
    });

    expect(html).toContain("max-width:680px");
    expect(html).toContain('style="width:680px;"');
  });

  it("keeps a single modest horizontal gutter for the content column", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello</p>",
      config: testConfig,
    });

    expect(html).toContain("padding:32px 16px 0");
    expect(html).toContain('padding:0;word-break:break-word;');
  });

  it("escapes HTML in config name and URL", () => {
    const evilConfig = {
      ...testConfig,
      name: 'News & "Letters"',
      url: "https://example.com/?a=1&b=2",
    };

    const html = EmailPage({
      title: "Test",
      issue: 1,
      content: "<p>Hello</p>",
      config: evilConfig,
    });

    expect(html).toContain("News &amp; &quot;Letters&quot;");
    expect(html).toContain("https://example.com/?a=1&amp;b=2");
  });
});
