import { readFileSync, readdirSync, writeFileSync, statSync, type Stats } from "node:fs";
import { join, extname, basename } from "node:path";
import matter from "@11ty/gray-matter";
import { extractHeading } from "../pipeline/heading.js";

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

interface StampResult {
  filename: string;
  issue: number;
  warning?: string;
}

interface StampOutput {
  stamped: StampResult[];
  skipped: Array<{ filename: string }>;
}

function getCreationOrderTime(stat: Stats): Date {
  const birthtimeMs = stat.birthtime.getTime();
  if (!Number.isFinite(birthtimeMs) || birthtimeMs <= 0) {
    return stat.mtime;
  }

  // On some filesystems Node reports `birthtime` as `ctime` when true
  // creation time is unavailable. In that case prefer `mtime`, which our
  // tests can control deterministically with `utimesSync`.
  if (birthtimeMs === stat.ctime.getTime() && birthtimeMs !== stat.mtime.getTime()) {
    return stat.mtime;
  }

  return stat.birthtime;
}

export async function runStamp(issuesDir: string): Promise<StampOutput> {
  const files = readdirSync(issuesDir)
    .filter((f) => extname(f) === ".md");

  const toStamp: Array<{
    filename: string;
    content: string;
    birthtime: Date;
    inferred: InferResult | null;
  }> = [];
  const skipped: Array<{ filename: string }> = [];

  for (const filename of files) {
    const filePath = join(issuesDir, filename);
    const raw = readFileSync(filePath, "utf8");
    const { data, content } = matter(raw);

    if (Object.keys(data).length > 0) {
      skipped.push({ filename });
      continue;
    }

    const heading = extractHeading(content);
    const inferred = inferIssueNumber(filename, heading);
    const stat = statSync(filePath);

    toStamp.push({
      filename,
      content: raw,
      birthtime: getCreationOrderTime(stat),
      inferred,
    });
  }

  // Resolve issue numbers: collect claimed numbers, handle duplicates
  const claimed = new Map<number, { filename: string; birthtime: Date }>();
  const needsFallback: typeof toStamp = [];

  // First pass: collect all inferred numbers, detect duplicates
  for (const file of toStamp) {
    if (!file.inferred) {
      needsFallback.push(file);
      continue;
    }

    const num = file.inferred.issue;
    const existing = claimed.get(num);

    if (!existing) {
      claimed.set(num, { filename: file.filename, birthtime: file.birthtime });
    } else if (file.birthtime < existing.birthtime) {
      // This file is older, it keeps the number; existing goes to fallback
      const displaced = toStamp.find((f) => f.filename === existing.filename)!;
      needsFallback.push(displaced);
      claimed.set(num, { filename: file.filename, birthtime: file.birthtime });
    } else {
      // Existing file is older, this one goes to fallback
      needsFallback.push(file);
    }
  }

  // Sort fallback files by birthtime
  needsFallback.sort((a, b) => a.birthtime.getTime() - b.birthtime.getTime());

  // Assign fallback numbers
  const fallbackAssignments = new Map<string, number>();
  for (const file of needsFallback) {
    let next = 1;
    while (claimed.has(next)) next++;
    claimed.set(next, { filename: file.filename, birthtime: file.birthtime });
    fallbackAssignments.set(file.filename, next);
  }

  // Write frontmatter to files
  const stamped: StampResult[] = [];

  for (const file of toStamp) {
    const fallbackNum = fallbackAssignments.get(file.filename);
    const issue = fallbackNum ?? file.inferred!.issue;
    const warning = fallbackNum !== undefined
      ? "issue number guessed from file creation time"
      : undefined;

    const frontmatter = `---\nissue: ${issue}\nstatus: draft\n---\n\n`;
    writeFileSync(join(issuesDir, file.filename), frontmatter + file.content);

    stamped.push({ filename: file.filename, issue, warning });
  }

  stamped.sort((a, b) => a.issue - b.issue);

  return { stamped, skipped };
}
