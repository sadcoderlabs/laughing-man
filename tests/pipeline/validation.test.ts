import { describe, expect, it } from "bun:test";
import { validateIssues } from "../../src/pipeline/validation";
import type { IssueData } from "../../src/types";

function makeIssue(overrides: Partial<IssueData> = {}): IssueData {
  return {
    issue: 1,
    status: "ready",
    title: "My Title",
    filePath: "/newsletter/issue-1.md",
    rawContent: "# My Title\n\nContent here.",
    html: "<h1>My Title</h1><p>Content here.</p>",
    ...overrides,
  };
}

describe("validateIssues", () => {
  it("accepts valid issues with no errors", () => {
    const issues = [
      makeIssue({ issue: 1 }),
      makeIssue({ issue: 2, filePath: "/newsletter/issue-2.md" }),
    ];
    expect(() => validateIssues(issues)).not.toThrow();
  });

  it("throws on duplicate issue numbers", () => {
    const issues = [
      makeIssue({ issue: 1, filePath: "/newsletter/a.md" }),
      makeIssue({ issue: 1, filePath: "/newsletter/b.md" }),
    ];
    expect(() => validateIssues(issues)).toThrow("Duplicate issue number 1");
  });

  it("throws listing both files on duplicate", () => {
    const issues = [
      makeIssue({ issue: 1, filePath: "/newsletter/a.md" }),
      makeIssue({ issue: 1, filePath: "/newsletter/b.md" }),
    ];
    try {
      validateIssues(issues);
      expect(true).toBe(false); // should not reach here
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain("a.md");
      expect(msg).toContain("b.md");
    }
  });

  it("throws if title is missing (no # heading)", () => {
    const issues = [makeIssue({ title: "", rawContent: "No heading here." })];
    expect(() => validateIssues(issues)).toThrow("missing a # heading");
  });

  it("accepts draft issues without throwing", () => {
    const issues = [makeIssue({ status: "draft" })];
    expect(() => validateIssues(issues)).not.toThrow();
  });

  it("accepts a single ready issue", () => {
    const issues = [makeIssue({ status: "ready" })];
    expect(() => validateIssues(issues)).not.toThrow();
  });
});
