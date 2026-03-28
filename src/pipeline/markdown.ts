import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import matter from "@11ty/gray-matter";
import { marked } from "marked";
import { z } from "zod";
import type { IssueData } from "../types.js";

const FrontmatterSchema = z.object({
  issue: z.number({
    error: (iss) =>
      iss.input === undefined ? "issue is required" : "issue must be a positive integer",
  }).int().positive(),
  status: z.enum(["draft", "ready"], {
    error: (iss) =>
      iss.input === undefined
        ? "status is required"
        : `status must be 'draft' or 'ready', got '${iss.input}'`,
  }),
});

function extractTitle(markdown: string): string {
  const stripped = markdown.replace(/^```[\s\S]*?^```/gm, "");
  const match = stripped.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

export async function parseIssueFile(filePath: string): Promise<IssueData> {
  const raw = readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const result = FrontmatterSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join(", ");
    throw new Error(`${filePath}: invalid frontmatter — ${messages}`);
  }

  const { issue, status } = result.data;
  const title = extractTitle(content);
  const html = await marked(content);

  return {
    issue,
    status,
    title,
    filePath,
    rawContent: content,
    html,
  };
}

export async function scanIssuesDir(issuesDir: string): Promise<IssueData[]> {
  const files = readdirSync(issuesDir).filter((f) => extname(f) === ".md");
  return Promise.all(files.map((f) => parseIssueFile(join(issuesDir, f))));
}
