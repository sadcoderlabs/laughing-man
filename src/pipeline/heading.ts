export function extractHeading(markdown: string): string {
  const stripped = markdown.replace(/^```[\s\S]*?^```/gm, "");
  const match = stripped.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}
