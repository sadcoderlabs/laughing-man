import { readFileSync } from "node:fs";

const stylesPath = new URL("styles.css", import.meta.url).pathname;
const faviconPath = new URL("favicon.svg", import.meta.url).pathname;

export function readStyles() {
  return readFileSync(stylesPath, "utf8");
}

export function readFaviconDataUri() {
  const favicon = readFileSync(faviconPath, "utf8");
  return `data:image/svg+xml,${encodeURIComponent(favicon)}`;
}
