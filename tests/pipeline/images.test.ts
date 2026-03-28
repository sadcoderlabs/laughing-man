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
});
