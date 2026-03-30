import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import matter from "@11ty/gray-matter";
import { marked } from "marked";
import { z } from "zod";
import type { IssueData } from "../types.js";
import { extractHeading } from "./heading.js";

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
  title: z.string().optional(),
  date: z.preprocess(
    (val) => val instanceof Date ? val.toISOString().slice(0, 10) : val,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
  ).optional(),
});

async function parseIssueRaw(filePath: string, raw: string): Promise<IssueData> {
  const { data, content } = matter(raw);

  const result = FrontmatterSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join(", ");
    throw new Error(`${filePath}: invalid frontmatter — ${messages}`);
  }

  const { issue, status, date } = result.data;
  const title = result.data.title ?? extractHeading(content);
  const html = await marked(content);

  return {
    issue,
    status,
    title,
    date,
    filePath,
    rawContent: content,
    html,
  };
}

export async function parseIssueFile(filePath: string): Promise<IssueData> {
  return parseIssueRaw(filePath, readFileSync(filePath, "utf8"));
}

export async function scanIssuesDir(issuesDir: string): Promise<IssueData[]> {
  const files = readdirSync(issuesDir).filter((f) => extname(f) === ".md");

  if (files.length === 0) {
    throw new Error(
      "No issues found. Run 'laughing-man stamp' to add frontmatter to your .md files."
    );
  }

  // Read all files once. If every file lacks frontmatter, suggest `stamp`
  // instead of throwing cryptic per-file validation errors.
  const rawContents = files.map((f) => ({
    filePath: join(issuesDir, f),
    raw: readFileSync(join(issuesDir, f), "utf8"),
  }));

  const allBare = rawContents.every(
    ({ raw }) => Object.keys(matter(raw).data).length === 0,
  );

  if (allBare) {
    throw new Error(
      "No issues found. Run 'laughing-man stamp' to add frontmatter to your .md files."
    );
  }

  return Promise.all(rawContents.map(({ filePath, raw }) => parseIssueRaw(filePath, raw)));
}
