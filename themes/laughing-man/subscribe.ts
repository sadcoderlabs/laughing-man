import { escapeHtml } from "./escape.js";

export function subscribeScriptTag(scriptHref: string): string {
  return `<script src="${escapeHtml(scriptHref)}" defer></script>`;
}
