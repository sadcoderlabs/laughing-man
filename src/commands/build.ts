import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../pipeline/config.js";
import { scanIssuesDir } from "../pipeline/markdown.js";
import { validateIssues } from "../pipeline/validation.js";
import { processImages } from "../pipeline/images.js";
import type { SiteConfig } from "../types.js";

interface BuildOptions {
  configDir: string;
  includeDrafts: boolean;
}

interface BuildResult {
  config: SiteConfig;
  outputDir: string;
}

const themesDir = resolve(import.meta.dirname, "../../themes/default");

export async function runBuild(options: BuildOptions): Promise<BuildResult> {
  const { configDir, includeDrafts } = options;

  const bust = `?v=${Date.now()}`;
  const [{ EmailPage }, { WebPage }, { IndexPage }] = await Promise.all([
    import(`${themesDir}/email.ts${bust}`),
    import(`${themesDir}/web.ts${bust}`),
    import(`${themesDir}/index.ts${bust}`),
  ]);

  const config = await loadConfig(configDir);
  const allIssues = await scanIssuesDir(config.issues_dir);

  validateIssues(allIssues);

  const issues = includeDrafts
    ? allIssues
    : allIssues.filter((i) => i.status === "ready");

  const draftIssueNumbers = includeDrafts
    ? []
    : allIssues.filter((i) => i.status === "draft").map((i) => i.issue);

  const sorted = [...issues].sort((a, b) => a.issue - b.issue);

  const outputDir = join(configDir, "output");
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

  // Copy Pages Functions into output/ so wrangler can find them
  const functionsSource = resolve(import.meta.dirname, "../../functions");
  if (existsSync(functionsSource)) {
    cpSync(functionsSource, join(outputDir, "functions"), { recursive: true });
  }

  const readyCount = sorted.length;
  const draftCount = allIssues.length - issues.length;
  const parts = [];
  if (readyCount > 0) parts.push(`${readyCount} ready`);
  if (draftCount > 0) parts.push(`${draftCount} draft`);
  const summary = parts.length > 0 ? parts.join(", ") : "no issues found";
  console.log(`Build complete: ${summary} — ${outputDir}`);

  return { config, outputDir };
}
