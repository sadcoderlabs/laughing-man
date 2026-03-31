import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../pipeline/config.js";
import { scanIssuesDir } from "../pipeline/markdown.js";
import { backfillDates, validateIssues } from "../pipeline/validation.js";
import { processImages } from "../pipeline/images.js";
import type { SiteConfig } from "../types.js";

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
  const [{ EmailPage }, { WebPage }, { IndexPage }, { NotFoundPage }] = await Promise.all([
    import(themeUrl("email")),
    import(themeUrl("web")),
    import(themeUrl("index")),
    import(themeUrl("not-found")),
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

  const outputDir = join(configDir, outputDirName);
  const websiteDir = join(outputDir, "website");
  const emailDir = join(outputDir, "email");

  rmSync(outputDir, { recursive: true, force: true });

  mkdirSync(websiteDir, { recursive: true });
  mkdirSync(emailDir, { recursive: true });

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
  }

  const indexHtml = IndexPage({ issues: sorted, draftIssueNumbers, config });
  writeFileSync(join(websiteDir, "index.html"), indexHtml, "utf8");

  const notFoundHtml = NotFoundPage({ config });
  writeFileSync(join(websiteDir, "404.html"), notFoundHtml, "utf8");

  // Copy static assets (OG image) into website root
  const ogImageSource = resolve(import.meta.dirname, "../../themes/default/laughing-man.png");
  if (existsSync(ogImageSource)) {
    cpSync(ogImageSource, join(websiteDir, "laughing-man.png"));
  }

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
