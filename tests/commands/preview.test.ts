import { describe, expect, it } from "bun:test";
import { getPreviewContentType, shouldIgnorePreviewWatchEvent } from "../../src/commands/preview";

describe("getPreviewContentType", () => {
  it("serves feed.xml as RSS", () => {
    expect(getPreviewContentType("/feed.xml", "/tmp/feed.xml")).toBe(
      "application/rss+xml; charset=utf-8",
    );
  });

  it("serves other XML files as generic XML", () => {
    expect(getPreviewContentType("/sitemap.xml", "/tmp/sitemap.xml")).toBe(
      "application/xml; charset=utf-8",
    );
  });
});

describe("shouldIgnorePreviewWatchEvent", () => {
  const issuesDir = "/tmp/newsletter";
  const previewDir = "/tmp/newsletter/preview";

  it("ignores null filenames from fs.watch", () => {
    expect(shouldIgnorePreviewWatchEvent(null, issuesDir, previewDir)).toBe(true);
  });

  it("ignores writes inside preview output", () => {
    expect(
      shouldIgnorePreviewWatchEvent("preview/website/index.html", issuesDir, previewDir),
    ).toBe(true);
  });

  it("allows real issue edits through", () => {
    expect(
      shouldIgnorePreviewWatchEvent("issue-1.md", issuesDir, previewDir),
    ).toBe(false);
  });

  it("ignores non-markdown files in the issues root", () => {
    expect(
      shouldIgnorePreviewWatchEvent(".DS_Store", issuesDir, previewDir),
    ).toBe(true);
  });

  it("ignores nested markdown files outside the scanned issue set", () => {
    expect(
      shouldIgnorePreviewWatchEvent("preview/draft.md", issuesDir, previewDir),
    ).toBe(true);
    expect(
      shouldIgnorePreviewWatchEvent("nested/issue-2.md", issuesDir, previewDir),
    ).toBe(true);
  });
});
