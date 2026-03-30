import { describe, expect, it } from "bun:test";
import { inferIssueNumber } from "../../src/commands/stamp";

describe("inferIssueNumber", () => {
  it("extracts leading number from filename", () => {
    expect(inferIssueNumber("01-hello.md", "# Hello")).toEqual({
      issue: 1,
      source: "filename",
    });
  });

  it("extracts number with space separator", () => {
    expect(inferIssueNumber("3 my post.md", "# My Post")).toEqual({
      issue: 3,
      source: "filename",
    });
  });

  it("extracts number with no separator", () => {
    expect(inferIssueNumber("42post.md", "# Post")).toEqual({
      issue: 42,
      source: "filename",
    });
  });

  it("extracts number from heading when filename has no number", () => {
    expect(inferIssueNumber("hello.md", "# Issue 3: Hello")).toEqual({
      issue: 3,
      source: "heading",
    });
  });

  it("extracts number from heading with different patterns", () => {
    expect(inferIssueNumber("hello.md", "# Issue 12 My Title")).toEqual({
      issue: 12,
      source: "heading",
    });
  });

  it("prefers filename number over heading number", () => {
    expect(inferIssueNumber("5-hello.md", "# Issue 3: Hello")).toEqual({
      issue: 5,
      source: "filename",
    });
  });

  it("returns null when no number can be inferred", () => {
    expect(inferIssueNumber("hello.md", "# Hello World")).toBeNull();
  });

  it("returns null when heading is empty", () => {
    expect(inferIssueNumber("hello.md", "")).toBeNull();
  });

  it("ignores zero as issue number in filename", () => {
    expect(inferIssueNumber("0-intro.md", "# Intro")).toBeNull();
  });

  it("ignores negative numbers in filename", () => {
    expect(inferIssueNumber("-1-hello.md", "# Hello")).toBeNull();
  });
});
