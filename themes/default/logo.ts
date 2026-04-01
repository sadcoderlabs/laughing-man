import { readFileSync } from "node:fs";

const logoPath = new URL("assets/laughing-man.svg", import.meta.url).pathname;

export function readLaughingManLogo() {
  return readFileSync(logoPath, "utf8")
    .replace(/<\?xml[\s\S]*?\?>\s*/u, "")
    .replace(/<!--[\s\S]*?-->\s*/u, "")
    .replace(/\s(width|height)="[^"]*"/gu, "")
    .replace(/<svg\b/u, '<svg class="laughing-man-logo-svg" focusable="false"');
}
