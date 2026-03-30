import { readFileSync } from "node:fs";

const stylesPath = new URL("styles.css", import.meta.url).pathname;
const faviconPath = new URL("favicon.svg", import.meta.url).pathname;

export const styles = readFileSync(stylesPath, "utf8");

const favicon = readFileSync(faviconPath, "utf8");
export const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
