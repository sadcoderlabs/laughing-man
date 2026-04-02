import { readFileSync } from "node:fs";

const stylesPath = new URL("assets/styles.css", import.meta.url).pathname;
const subscribeScriptPath = new URL("assets/subscribe.js", import.meta.url).pathname;
const FAVICON_FILE_NAME = "favicon.svg";
const ICON_512_FILE_NAME = "icon-512.png";
const APPLE_TOUCH_ICON_FILE_NAME = "apple-touch-icon.png";
const OG_IMAGE_FILE_NAME = "laughing-man.png";

export function readStyles() {
  return readFileSync(stylesPath, "utf8");
}

export function readSubscribeScript() {
  return readFileSync(subscribeScriptPath, "utf8");
}

function publicSiteUrl(siteUrl: string): string {
  return siteUrl.replace(/\/$/, "");
}

export { FAVICON_FILE_NAME, ICON_512_FILE_NAME, APPLE_TOUCH_ICON_FILE_NAME, OG_IMAGE_FILE_NAME };

export function faviconUrl(siteUrl: string): string {
  return `${publicSiteUrl(siteUrl)}/${FAVICON_FILE_NAME}`;
}

export function iconUrl(siteUrl: string): string {
  return `${publicSiteUrl(siteUrl)}/${ICON_512_FILE_NAME}`;
}

export function ogImageUrl(siteUrl: string): string {
  return `${publicSiteUrl(siteUrl)}/assets/${OG_IMAGE_FILE_NAME}`;
}

export function faviconLinkTags(): string {
  return [
    `<link rel="icon" type="image/svg+xml" href="/${FAVICON_FILE_NAME}">`,
    `<link rel="apple-touch-icon" href="/${APPLE_TOUCH_ICON_FILE_NAME}">`,
  ].join("\n    ");
}
