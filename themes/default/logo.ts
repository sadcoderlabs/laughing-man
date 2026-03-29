import { readFileSync } from "node:fs";

export const laughingManLogo = readFileSync(
  new URL("laughing-man.svg", import.meta.url).pathname,
  "utf8",
)
  .replace(/<\?xml[\s\S]*?\?>\s*/u, "")
  .replace(/<!--[\s\S]*?-->\s*/u, "")
  .replace(/\s(width|height)="[^"]*"/gu, "")
  .replace(/<svg\b/u, '<svg class="laughing-man-logo-svg" focusable="false"');
