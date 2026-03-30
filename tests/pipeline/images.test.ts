import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { processImages } from "../../src/pipeline/images";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

describe("processImages", () => {
  let tmpDir: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-img-test-"));
    outputDir = join(tmpDir, "output");
    mkdirSync(join(tmpDir, "issues"), { recursive: true });
    mkdirSync(join(tmpDir, "Attachments"), { recursive: true });
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rewrites relative img src for web and email", async () => {
    const imgPath = join(tmpDir, "issues", "cover.jpg");
    writeFileSync(imgPath, "fake-image-data");

    const html = `<p><img src="cover.jpg" alt="Cover"></p>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain('src="/images/1/cover.jpg"');
    expect(result.emailHtml).toContain('src="https://example.com/images/1/cover.jpg"');
    expect(existsSync(join(outputDir, "images", "1", "cover.jpg"))).toBe(true);
  });

  it("resolves image from attachments_dir if not found relative to markdown", async () => {
    const imgPath = join(tmpDir, "Attachments", "photo.jpg");
    writeFileSync(imgPath, "fake-image-data");

    const html = `<img src="photo.jpg">`;
    const result = await processImages({
      html,
      issueNumber: 2,
      markdownFilePath: join(tmpDir, "issues", "issue-2.md"),
      attachmentsDir: join(tmpDir, "Attachments"),
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain('src="/images/2/photo.jpg"');
    expect(existsSync(join(outputDir, "images", "2", "photo.jpg"))).toBe(true);
  });

  it("does not touch absolute or external image src", async () => {
    const html = `<img src="https://cdn.example.com/photo.jpg">`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain('src="https://cdn.example.com/photo.jpg"');
    expect(result.emailHtml).toContain('src="https://cdn.example.com/photo.jpg"');
  });

  it("adds responsive constraints to email images", async () => {
    const imgPath = join(tmpDir, "issues", "cover.jpg");
    writeFileSync(imgPath, "fake-image-data");

    const html = `<p><img src="cover.jpg" alt="Cover"></p>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toBe(`<p><img src="/images/1/cover.jpg" alt="Cover"></p>`);
    expect(result.emailHtml).toContain('width="100%"');
    expect(result.emailHtml).toContain('style="display:block;max-width:100%;height:auto;"');
  });

  it("preserves explicit image widths while adding responsive styles for email", async () => {
    const html = `<img src="https://cdn.example.com/photo.jpg" width="320" style="border-radius:8px;">`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.emailHtml).toContain('width="320"');
    expect(result.emailHtml).toContain('style="border-radius:8px;display:block;max-width:100%;height:auto;"');
  });

  it("resolves Obsidian-style paths where src includes a folder that matches attachments_dir", async () => {
    const imgPath = join(tmpDir, "Attachments", "photo.jpg");
    writeFileSync(imgPath, "fake-image-data");

    const html = `<img src="Attachments/photo.jpg">`;
    const result = await processImages({
      html,
      issueNumber: 3,
      markdownFilePath: join(tmpDir, "issues", "issue-3.md"),
      attachmentsDir: join(tmpDir, "Attachments"),
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain('src="/images/3/photo.jpg"');
    expect(existsSync(join(outputDir, "images", "3", "photo.jpg"))).toBe(true);
  });

  it("throws if relative image cannot be found", async () => {
    const html = `<img src="missing.jpg">`;
    await expect(
      processImages({
        html,
        issueNumber: 1,
        markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
        attachmentsDir: undefined,
        outputDir,
        siteUrl: "https://example.com",
      })
    ).rejects.toThrow("missing.jpg");
  });

  it("throws on filename collision from different sources", async () => {
    // Same filename in both issues dir and attachments dir, different content
    writeFileSync(join(tmpDir, "issues", "photo.jpg"), "image-version-1");
    writeFileSync(join(tmpDir, "Attachments", "photo.jpg"), "image-version-2-longer");

    const html = `<img src="photo.jpg"><img src="Attachments/photo.jpg">`;
    await expect(
      processImages({
        html,
        issueNumber: 1,
        markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
        attachmentsDir: join(tmpDir, "Attachments"),
        outputDir,
        siteUrl: "https://example.com",
      })
    ).rejects.toThrow("Filename collision");
  });

  it("throws on filename collision even when files have the same size", async () => {
    writeFileSync(join(tmpDir, "issues", "photo.jpg"), "AAAAAAAAAA");
    writeFileSync(join(tmpDir, "Attachments", "photo.jpg"), "BBBBBBBBBB");

    const html = `<img src="photo.jpg"><img src="Attachments/photo.jpg">`;
    await expect(
      processImages({
        html,
        issueNumber: 1,
        markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
        attachmentsDir: join(tmpDir, "Attachments"),
        outputDir,
        siteUrl: "https://example.com",
      })
    ).rejects.toThrow("Filename collision");
  });

  it("replaces YouTube iframe with linked thumbnail in email HTML", async () => {
    const html = `<p>Watch this:</p><iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=abc123" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    // Web HTML keeps the iframe untouched
    expect(result.webHtml).toContain("<iframe");
    expect(result.webHtml).toContain("youtube.com/embed/dQw4w9WgXcQ");

    // Email HTML replaces with linked thumbnail
    expect(result.emailHtml).not.toContain("<iframe");
    expect(result.emailHtml).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    expect(result.emailHtml).toContain('src="https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"');
    expect(result.emailHtml).toContain('alt="YouTube video player"');
    expect(result.emailHtml).toContain('width="100%"');
    expect(result.emailHtml).toContain('style="width:100%;max-width:100%;border-radius:8px;display:block;max-width:100%;height:auto;"');
  });

  it("handles youtube-nocookie.com iframe", async () => {
    const html = `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/WB-ik-Bpl0c?si=fsCLzM9Ll" title="My Video" frameborder="0" allowfullscreen></iframe>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain("<iframe");
    expect(result.emailHtml).not.toContain("<iframe");
    expect(result.emailHtml).toContain('href="https://www.youtube.com/watch?v=WB-ik-Bpl0c"');
    expect(result.emailHtml).toContain('src="https://img.youtube.com/vi/WB-ik-Bpl0c/hqdefault.jpg"');
    expect(result.emailHtml).toContain('alt="My Video"');
    expect(result.emailHtml).toContain('width="100%"');
  });

  it("uses default alt text when iframe has no title", async () => {
    const html = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0"></iframe>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.emailHtml).toContain('alt="YouTube video"');
  });

  it("does not touch non-YouTube iframes", async () => {
    const html = `<iframe src="https://open.spotify.com/embed/track/abc"></iframe>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    // Both keep the original iframe (email clients will strip it, but we don't transform it)
    expect(result.webHtml).toContain("spotify.com");
    expect(result.emailHtml).toContain("spotify.com");
  });
});
