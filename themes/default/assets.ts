import { readFileSync } from "node:fs";

const stylesPath = new URL("assets/styles.css", import.meta.url).pathname;
const subscribeScriptPath = new URL("assets/subscribe.js", import.meta.url).pathname;
const FAVICON_SVG_FILE_NAME = "favicon.svg";
const FAVICON_ICO_FILE_NAME = "favicon.ico";
const ICON_FILE_NAME = "icon.png";
const APPLE_TOUCH_ICON_FILE_NAME = "apple-touch-icon.png";
const OG_IMAGE_FILE_NAME = "cover.png";

export function readStyles() {
  return readFileSync(stylesPath, "utf8");
}

export function readSubscribeScript() {
  return readFileSync(subscribeScriptPath, "utf8");
}

function publicSiteUrl(siteUrl: string): string {
  return siteUrl.replace(/\/$/, "");
}

export { FAVICON_SVG_FILE_NAME, FAVICON_ICO_FILE_NAME, ICON_FILE_NAME, APPLE_TOUCH_ICON_FILE_NAME, OG_IMAGE_FILE_NAME };

export function faviconUrl(siteUrl: string): string {
  return `${publicSiteUrl(siteUrl)}/${FAVICON_SVG_FILE_NAME}`;
}

export function iconUrl(siteUrl: string): string {
  return `${publicSiteUrl(siteUrl)}/assets/${ICON_FILE_NAME}`;
}

export function ogImageUrl(siteUrl: string): string {
  return `${publicSiteUrl(siteUrl)}/assets/${OG_IMAGE_FILE_NAME}`;
}

export function faviconLinkTags(): string {
  return [
    `<link rel="icon" href="/${FAVICON_ICO_FILE_NAME}" sizes="32x32">`,
    `<link rel="icon" type="image/svg+xml" href="/${FAVICON_SVG_FILE_NAME}">`,
    `<link rel="apple-touch-icon" href="/${APPLE_TOUCH_ICON_FILE_NAME}">`,
  ].join("\n    ");
}
