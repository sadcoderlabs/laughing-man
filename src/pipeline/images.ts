import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, basename, isAbsolute } from "node:path";

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

export async function processImages(
  options: ProcessImagesOptions
): Promise<ProcessImagesResult> {
  const { html, issueNumber, markdownFilePath, attachmentsDir, outputDir, siteUrl } = options;

  const imgPattern = /<img([^>]*?)src="([^"]+)"([^>]*?)>/g;

  const imageOutputDir = join(outputDir, "images", String(issueNumber));
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
    const webSrc = `/images/${issueNumber}/${encodedFilename}`;
    const emailSrc = `${siteUrl.replace(/\/$/, "")}/images/${issueNumber}/${encodedFilename}`;

    const webTag = `<img${before}src="${webSrc}"${after}>`;
    const emailTag = `<img${before}src="${emailSrc}"${after}>`;

    webHtml = webHtml.replace(fullTag, webTag);
    emailHtml = emailHtml.replace(fullTag, emailTag);
  }

  return { webHtml, emailHtml };
}
