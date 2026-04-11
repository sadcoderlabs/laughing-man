interface SitemapEntry {
  url: string;
  lastmod: string;
}

export function generateSitemap(
  siteUrl: string,
  issues: readonly { issue: number; date?: string }[],
): string {
  const today = new Date().toISOString().slice(0, 10);
  const mostRecentDate =
    issues.length > 0
      ? issues.reduce(
          (latest, i) => (i.date && i.date > latest ? i.date : latest),
          issues[0].date ?? today,
        )
      : today;

  const entries: SitemapEntry[] = [
    { url: `${siteUrl}/`, lastmod: mostRecentDate },
    ...issues.map((i) => ({
      url: `${siteUrl}/issues/${i.issue}/`,
      lastmod: i.date ?? today,
    })),
  ];

  const urls = entries
    .map(
      (e) => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function generateRobotsTxt(siteUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
}

interface LlmsTxtIssue {
  issue: number;
  title: string;
  date?: string;
}

export function generateLlmsTxt(
  siteUrl: string,
  name: string,
  description: string | undefined,
  issues: readonly LlmsTxtIssue[],
  author?: { name: string; url?: string; x_handle?: string },
): string {
  const lines: string[] = [`# ${name}`];

  if (description) {
    lines.push("", `> ${description}`);
  }

  if (issues.length > 0) {
    lines.push("", "## Issues", "");
    for (const i of issues) {
      const dateSuffix = i.date ? ` (${i.date})` : "";
      lines.push(`- [Issue ${i.issue}: ${i.title}](${siteUrl}/issues/${i.issue}.md)${dateSuffix}`);
    }
  }

  if (author) {
    lines.push("", "## Author", "");
    const handle = author.x_handle?.replace(/^@/, "");
    if (author.url && handle) {
      lines.push(`- [${author.name}](${author.url}) ([@${handle}](https://x.com/${handle}))`);
    } else if (handle) {
      lines.push(`- [@${handle}](https://x.com/${handle})`);
    } else if (author.url) {
      lines.push(`- [${author.name}](${author.url})`);
    } else {
      lines.push(`- ${author.name}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
