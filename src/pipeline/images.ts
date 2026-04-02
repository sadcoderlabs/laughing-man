import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, basename, isAbsolute } from "node:path";
import { escapeHtml } from "../escape.js";

interface ProcessImagesOptions {
  html: string;
  issueNumber: number;
  markdownFilePath: string;
  attachmentsDir: string | undefined;
  outputDir: string;
  siteUrl: string;
}

interface ProcessImagesResult {
  webHtml: string;
  emailHtml: string;
}

const EMAIL_IMAGE_STYLE = "display:block;max-width:100%;height:auto;";

function resolveImagePath(
  src: string,
  markdownFilePath: string,
  attachmentsDir: string | undefined
): string | null {
  // Try relative to markdown file directory
  const fromMarkdown = join(dirname(markdownFilePath), src);
  if (existsSync(fromMarkdown)) return fromMarkdown;

  // Try relative to attachments_dir (full src path)
  if (attachmentsDir) {
    const fromAttachments = join(attachmentsDir, src);
    if (existsSync(fromAttachments)) return fromAttachments;
  }

  // Try basename only in attachments_dir (handles Obsidian-style paths like
  // "Attachments/photo.jpg" when attachments_dir already points to Attachments/)
  if (attachmentsDir && basename(src) !== src) {
    const fromAttachmentsBase = join(attachmentsDir, basename(src));
    if (existsSync(fromAttachmentsBase)) return fromAttachmentsBase;
  }

  return null;
}

function appendInlineStyle(tag: string, styleToAppend: string): string {
  const styleAttr = tag.match(/\sstyle="([^"]*)"/i);
  if (!styleAttr) {
    return tag.replace(/<img\b/i, `<img style="${styleToAppend}"`);
  }

  const existing = styleAttr[1].trim();
  const separator = existing.length > 0 && !existing.endsWith(";") ? ";" : "";
  return tag.replace(styleAttr[0], ` style="${existing}${separator}${styleToAppend}"`);
}

function makeEmailImagesResponsive(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    let responsiveTag = tag;

    if (!/\swidth\s*=/i.test(responsiveTag)) {
      responsiveTag = responsiveTag.replace(/<img\b/i, '<img width="100%"');
    }

    return appendInlineStyle(responsiveTag, EMAIL_IMAGE_STYLE);
  });
}

export async function processImages(
  options: ProcessImagesOptions
): Promise<ProcessImagesResult> {
  const { html, issueNumber, markdownFilePath, attachmentsDir, outputDir, siteUrl } = options;

  const imgPattern = /<img([^>]*?)src="([^"]+)"([^>]*?)>/g;

  const imageOutputDir = join(outputDir, "issues", String(issueNumber), "assets");
  let webHtml = html;
  let emailHtml = html;
  const copiedImages = new Map<string, string>();

  const matches = [...html.matchAll(imgPattern)];

  for (const match of matches) {
    const [fullTag, before, src, after] = match;

    // Skip absolute URLs and data URIs
    if (
      isAbsolute(src) ||
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:")
    ) {
      continue;
    }

    const resolvedPath = resolveImagePath(src, markdownFilePath, attachmentsDir);
    if (!resolvedPath) {
      throw new Error(
        `Image not found: '${src}' referenced in ${markdownFilePath}. ` +
          `Searched relative to markdown file and attachments_dir.`
      );
    }

    const filename = basename(resolvedPath);
    const destPath = join(imageOutputDir, filename);

    const previousSource = copiedImages.get(filename);
    if (previousSource && previousSource !== resolvedPath) {
      throw new Error(
        `Filename collision: '${filename}' in issue ${issueNumber} resolves to different source files.`
      );
    }

    if (!previousSource) {
      mkdirSync(imageOutputDir, { recursive: true });
      copyFileSync(resolvedPath, destPath);
      copiedImages.set(filename, resolvedPath);
    }

    const encodedFilename = encodeURIComponent(filename);
    const webSrc = `/issues/${issueNumber}/assets/${encodedFilename}`;
    const emailSrc = `${siteUrl.replace(/\/$/, "")}/issues/${issueNumber}/assets/${encodedFilename}`;

    const webTag = `<img${before}src="${webSrc}"${after}>`;
    const emailTag = `<img${before}src="${emailSrc}"${after}>`;

    webHtml = webHtml.replace(fullTag, webTag);
    emailHtml = emailHtml.replace(fullTag, emailTag);
  }

  // Replace YouTube iframes with linked thumbnails in email HTML only
  const iframePattern = /<iframe\b[^>]*\bsrc="https?:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]+)[^"]*"[^>]*><\/iframe>/g;
  const iframeMatches = [...emailHtml.matchAll(iframePattern)];

  for (const match of iframeMatches) {
    const [fullTag, videoId] = match;
    const titleMatch = fullTag.match(/\btitle="([^"]*)"/);
    const rawAlt = titleMatch ? titleMatch[1] : "YouTube video";
    const alt = escapeHtml(rawAlt);

    const thumbnail = `<a href="https://www.youtube.com/watch?v=${videoId}" target="_blank"><img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${alt}" width="100%" style="width:100%;max-width:100%;border-radius:8px;" /></a>`;

    emailHtml = emailHtml.replace(fullTag, thumbnail);
  }

  emailHtml = makeEmailImagesResponsive(emailHtml);

  return { webHtml, emailHtml };
}
