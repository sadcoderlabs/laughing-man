import { readFileSync } from "node:fs";

const stylesPath = new URL("styles.css", import.meta.url).pathname;
const FAVICON_FILE_NAMES = [
  "favicon.svg",
  "favicon.ico",
  "favicon-32x32.png",
  "favicon-144x144.png",
] as const;

export function readStyles() {
  return readFileSync(stylesPath, "utf8");
}

function publicSiteUrl(siteUrl: string): string {
  return siteUrl.replace(/\/$/, "");
}

export function faviconFileNames(): readonly string[] {
  return FAVICON_FILE_NAMES;
}

export function faviconPngUrl(siteUrl: string): string {
  return `${publicSiteUrl(siteUrl)}/favicon-144x144.png`;
}

export function faviconLinkTags(siteUrl: string): string {
  const baseUrl = publicSiteUrl(siteUrl);

  return [
    `<link rel="icon" type="image/x-icon" href="${baseUrl}/favicon.ico">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${baseUrl}/favicon-32x32.png">`,
    `<link rel="icon" type="image/svg+xml" href="${baseUrl}/favicon.svg">`,
    `<link rel="apple-touch-icon" sizes="144x144" href="${baseUrl}/favicon-144x144.png">`,
  ].join("\n  ");
}
