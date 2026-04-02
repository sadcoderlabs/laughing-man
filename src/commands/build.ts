import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { loadConfig } from "../pipeline/config.js";
import { scanIssuesDir } from "../pipeline/markdown.js";
import { backfillDates, validateIssues } from "../pipeline/validation.js";
import { processImages } from "../pipeline/images.js";
import type { SiteConfig, IssueData } from "../types.js";
import { FAVICON_FILE_NAME, readStyles, readSubscribeScript } from "../../themes/default/assets.js";

const themesDir = resolve(import.meta.dirname, "../../themes/default");

interface BuildOptions {
  configDir: string;
  includeDrafts: boolean;
  outputDirName?: string;
}

interface BuildResult {
  config: SiteConfig;
  outputDir: string;
}

export async function runBuild(options: BuildOptions): Promise<BuildResult> {
  const { configDir, includeDrafts, outputDirName = "output" } = options;

  // Dynamic imports with cache-busting so preview rebuilds pick up theme changes
  const ext = existsSync(join(themesDir, "email.ts")) ? "ts" : "js";
  const bust = `?v=${Date.now()}`;
  const themeUrl = (name: string) =>
    `${pathToFileURL(join(themesDir, `${name}.${ext}`))}${bust}`;
  const [{ EmailPage }, { WebPage }, { IndexPage }, { NotFoundPage }, { generateSitemap, generateRobotsTxt }, { generateRssFeed }] = await Promise.all([
    import(themeUrl("email")),
    import(themeUrl("web")),
    import(themeUrl("index")),
    import(themeUrl("not-found")),
    import(themeUrl("seo")),
    import(themeUrl("rss")),
  ]);

  const config = await loadConfig(configDir);
  const allIssues = await scanIssuesDir(config.issues_dir);

  for (const b of backfillDates(allIssues)) {
    console.log(`Added date ${b.date} to Issue ${b.issue} (${b.filePath})`);
  }

  validateIssues(allIssues);

  const issues = includeDrafts
    ? allIssues
    : allIssues.filter((i) => i.status === "ready");

  const draftIssueNumbers = includeDrafts
    ? []
    : allIssues.filter((i) => i.status === "draft").map((i) => i.issue);

  const sorted = [...issues].sort((a, b) => a.issue - b.issue);
  const feedIssues: IssueData[] = [];

  const outputDir = join(configDir, outputDirName);
  const websiteDir = join(outputDir, "website");
  const emailDir = join(outputDir, "email");
  const websiteAssetsDir = join(websiteDir, "assets");

  rmSync(outputDir, { recursive: true, force: true });

  mkdirSync(websiteDir, { recursive: true });
  mkdirSync(emailDir, { recursive: true });
  mkdirSync(websiteAssetsDir, { recursive: true });

  const styles = readStyles();
  const stylesheetHash = createHash("sha256").update(styles).digest("hex").slice(0, 10);
  const stylesheetFileName = `styles.${stylesheetHash}.css`;
  const stylesheetHref = `/assets/${stylesheetFileName}`;
  const subscribeScript = readSubscribeScript();
  const subscribeScriptHash = createHash("sha256").update(subscribeScript).digest("hex").slice(0, 10);
  const subscribeScriptFileName = `subscribe.${subscribeScriptHash}.js`;
  const subscribeScriptHref = `/assets/${subscribeScriptFileName}`;

  writeFileSync(join(websiteAssetsDir, stylesheetFileName), styles, "utf8");
  writeFileSync(join(websiteAssetsDir, subscribeScriptFileName), subscribeScript, "utf8");

  for (const issue of sorted) {
    const { webHtml: contentWeb, emailHtml: contentEmail } = await processImages({
      html: issue.html,
      issueNumber: issue.issue,
      markdownFilePath: issue.filePath,
      attachmentsDir: config.attachments_dir,
      outputDir: websiteDir, // Images go inside website/ for deployment
      siteUrl: config.url,
    });

    const webPage = WebPage({
      title: issue.title,
      issue: issue.issue,
      date: issue.date,
      rawContent: issue.rawContent,
      content: contentWeb,
      config,
      stylesheetHref,
      subscribeScriptHref,
    });
    const issueDir = join(websiteDir, "issues", String(issue.issue));
    mkdirSync(issueDir, { recursive: true });
    writeFileSync(join(issueDir, "index.html"), webPage, "utf8");

    const emailHtml = EmailPage({
      title: issue.title,
      issue: issue.issue,
      content: contentEmail,
      config,
    });
    writeFileSync(join(emailDir, `${issue.issue}.html`), emailHtml, "utf8");

    feedIssues.push({
      ...issue,
      html: contentWeb,
    });
  }

  const indexHtml = IndexPage({ issues: sorted, draftIssueNumbers, config, stylesheetHref, subscribeScriptHref });
  writeFileSync(join(websiteDir, "index.html"), indexHtml, "utf8");

  const notFoundHtml = NotFoundPage({ config, stylesheetHref });
  writeFileSync(join(websiteDir, "404.html"), notFoundHtml, "utf8");

  // Copy static assets into website root.
  const faviconSource = resolve(import.meta.dirname, `../../themes/default/assets/${FAVICON_FILE_NAME}`);
  if (existsSync(faviconSource)) {
    cpSync(faviconSource, join(websiteDir, FAVICON_FILE_NAME));
  }

  const ogImageSource = resolve(import.meta.dirname, "../../themes/default/assets/laughing-man.png");
  if (existsSync(ogImageSource)) {
    cpSync(ogImageSource, join(websiteAssetsDir, "laughing-man.png"));
  }

  // Only route /api/* through Pages Functions; serve everything else as
  // static assets (free requests, lower latency, no CPU metering).
  writeFileSync(
    join(websiteDir, "_routes.json"),
    JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) + "\n",
    "utf8",
  );

  // Security headers for static assets. Functions set their own headers in
  // the Response object, so these only apply to HTML/CSS/image requests.
  writeFileSync(
    join(websiteDir, "_headers"),
    [
      "/*",
      "  X-Content-Type-Options: nosniff",
      "  Referrer-Policy: strict-origin-when-cross-origin",
      "  X-Frame-Options: DENY",
      "",
      "/feed.xml",
      "  Content-Type: application/rss+xml; charset=utf-8",
      "",
      `/assets/${stylesheetFileName}`,
      "  Cache-Control: public, max-age=31536000, immutable",
      "",
      `/assets/${subscribeScriptFileName}`,
      "  Cache-Control: public, max-age=31536000, immutable",
      "",
    ].join("\n"),
    "utf8",
  );

  writeFileSync(
    join(websiteDir, "sitemap.xml"),
    generateSitemap(config.url, sorted),
    "utf8",
  );

  writeFileSync(
    join(websiteDir, "feed.xml"),
    generateRssFeed({ config, issues: feedIssues }),
    "utf8",
  );

  writeFileSync(
    join(websiteDir, "robots.txt"),
    generateRobotsTxt(config.url),
    "utf8",
  );

  // Copy Pages Functions into output/ so wrangler can find them
  const functionsSource = resolve(import.meta.dirname, "../../functions");
  if (existsSync(functionsSource)) {
    cpSync(functionsSource, join(outputDir, "functions"), { recursive: true });
  }

  const readyCount = allIssues.filter((i) => i.status === "ready").length;
  const draftCount = allIssues.filter((i) => i.status === "draft").length;
  const parts = [];
  if (readyCount > 0) parts.push(`${readyCount} ready`);
  if (draftCount > 0) parts.push(`${draftCount} draft`);
  const summary = parts.length > 0 ? parts.join(", ") : "no issues found";
  console.log(`Build complete: ${summary} — ${outputDir}`);

  return { config, outputDir };
}
