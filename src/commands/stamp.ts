import { basename } from "node:path";

interface InferResult {
  issue: number;
  source: "filename" | "heading";
}

export function inferIssueNumber(
  filename: string,
  headingText: string,
): InferResult | null {
  // Strategy 1: leading number in filename
  const name = basename(filename, ".md");
  const filenameMatch = name.match(/^(\d+)/);
  if (filenameMatch) {
    const num = parseInt(filenameMatch[1], 10);
    if (num > 0) return { issue: num, source: "filename" };
  }

  // Strategy 2: "Issue N" pattern in heading
  if (headingText) {
    const headingMatch = headingText.match(/Issue\s+(\d+)/i);
    if (headingMatch) {
      const num = parseInt(headingMatch[1], 10);
      if (num > 0) return { issue: num, source: "heading" };
    }
  }

  return null;
}
