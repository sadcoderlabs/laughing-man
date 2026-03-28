import type { IssueData } from "../types.js";

export function validateIssues(issues: IssueData[]): void {
  const errors: string[] = [];

  // Check for missing titles
  for (const issue of issues) {
    if (!issue.title.trim()) {
      errors.push(
        `Issue ${issue.issue} (${issue.filePath}) is missing a # heading`
      );
    }
  }

  // Check for duplicate issue numbers
  const seen = new Map<number, string>();
  for (const issue of issues) {
    if (seen.has(issue.issue)) {
      errors.push(
        `Duplicate issue number ${issue.issue}: ${seen.get(issue.issue)} and ${issue.filePath}`
      );
    } else {
      seen.set(issue.issue, issue.filePath);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
