import { describe, expect, it } from "bun:test";
import { generateLlmsTxt } from "../../themes/default/seo";

describe("generateLlmsTxt author section", () => {
  const base = {
    siteUrl: "https://example.com",
    name: "Test Newsletter",
    description: undefined,
    issues: [] as const,
  };

  it("renders name linked to url with x_handle link when both are present", () => {
    const result = generateLlmsTxt(base.siteUrl, base.name, base.description, base.issues, {
      name: "Jane Doe",
      url: "https://janedoe.com",
      x_handle: "janedoe",
    });
    expect(result).toContain("[Jane Doe](https://janedoe.com) ([@janedoe](https://x.com/janedoe))");
  });

  it("normalizes x_handle with leading @", () => {
    const result = generateLlmsTxt(base.siteUrl, base.name, base.description, base.issues, {
      name: "Jane Doe",
      url: "https://janedoe.com",
      x_handle: "@janedoe",
    });
    expect(result).toContain("[@janedoe](https://x.com/janedoe)");
    expect(result).not.toContain("@@");
  });

  it("renders only x_handle link when url is absent", () => {
    const result = generateLlmsTxt(base.siteUrl, base.name, base.description, base.issues, {
      name: "Jane Doe",
      x_handle: "janedoe",
    });
    expect(result).toContain("- [@janedoe](https://x.com/janedoe)");
    expect(result).not.toContain("Jane Doe");
  });

  it("renders name linked to url when x_handle is absent", () => {
    const result = generateLlmsTxt(base.siteUrl, base.name, base.description, base.issues, {
      name: "Jane Doe",
      url: "https://janedoe.com",
    });
    expect(result).toContain("- [Jane Doe](https://janedoe.com)");
    expect(result).not.toContain("x.com");
  });

  it("renders plain name when only name is present", () => {
    const result = generateLlmsTxt(base.siteUrl, base.name, base.description, base.issues, {
      name: "Jane Doe",
    });
    expect(result).toContain("- Jane Doe");
    expect(result).not.toContain("[");
  });

  it("omits author section when author is undefined", () => {
    const result = generateLlmsTxt(base.siteUrl, base.name, base.description, base.issues);
    expect(result).not.toContain("## Author");
  });
});
