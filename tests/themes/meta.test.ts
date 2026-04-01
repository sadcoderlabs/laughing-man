import { describe, expect, it } from "bun:test";
import { websiteJsonLd, articleJsonLd, plainTextExcerpt } from "../../themes/default/meta";

describe("websiteJsonLd", () => {
  it("returns WebSite JSON-LD script tag", () => {
    const result = websiteJsonLd({
      name: "My Newsletter",
      url: "https://example.com/",
    });

    expect(result).toContain('<script type="application/ld+json">');
    expect(result).toContain("</script>");

    const json = JSON.parse(
      result.replace('<script type="application/ld+json">', "").replace("</script>", ""),
    );
    expect(json["@context"]).toBe("https://schema.org");
    expect(json["@type"]).toBe("WebSite");
    expect(json.name).toBe("My Newsletter");
    expect(json.url).toBe("https://example.com/");
    expect(json.description).toBeUndefined();
  });

  it("includes description when provided", () => {
    const result = websiteJsonLd({
      name: "My Newsletter",
      url: "https://example.com/",
      description: "A newsletter about things",
    });

    const json = JSON.parse(
      result.replace('<script type="application/ld+json">', "").replace("</script>", ""),
    );
    expect(json.description).toBe("A newsletter about things");
  });

  it("strips markdown from description", () => {
    const result = websiteJsonLd({
      name: "My Newsletter",
      url: "https://example.com/",
      description: "A **bold** newsletter about [things](https://example.com)",
    });

    const json = JSON.parse(
      result.replace('<script type="application/ld+json">', "").replace("</script>", ""),
    );
    expect(json.description).toBe("A bold newsletter about things");
  });
});

describe("articleJsonLd", () => {
  it("returns Article JSON-LD script tag", () => {
    const result = articleJsonLd({
      headline: "Issue One",
      datePublished: "2026-03-15",
      url: "https://example.com/issues/1/",
      description: "First 200 chars of plain text",
      imageUrl: "https://example.com/images/laughing-man.png",
      siteName: "My Newsletter",
      siteUrl: "https://example.com/",
    });

    expect(result).toContain('<script type="application/ld+json">');

    const json = JSON.parse(
      result.replace('<script type="application/ld+json">', "").replace("</script>", ""),
    );
    expect(json["@context"]).toBe("https://schema.org");
    expect(json["@type"]).toBe("Article");
    expect(json.headline).toBe("Issue One");
    expect(json.datePublished).toBe("2026-03-15");
    expect(json.url).toBe("https://example.com/issues/1/");
    expect(json.description).toBe("First 200 chars of plain text");
    expect(json.image).toBe("https://example.com/images/laughing-man.png");
    expect(json.isPartOf).toEqual({
      "@type": "WebSite",
      name: "My Newsletter",
      url: "https://example.com/",
    });
  });

  it("escapes HTML special characters in JSON", () => {
    const result = articleJsonLd({
      headline: 'Title with "quotes" & <brackets>',
      datePublished: "2026-03-15",
      url: "https://example.com/issues/1/",
      description: "Description with </script> attempt",
      imageUrl: "https://example.com/images/laughing-man.png",
      siteName: "My Newsletter",
      siteUrl: "https://example.com/",
    });

    // The JSON should be parseable and the </script> should not break out
    expect(result).not.toContain("</script><");
    expect(result.match(/<\/script>/g)?.length).toBe(1);
  });
});

describe("plainTextExcerpt", () => {
  it("strips markdown to plain text", () => {
    const result = plainTextExcerpt("# Title\n\nHello **world**.");
    expect(result).toBe("Hello world.");
  });
});
