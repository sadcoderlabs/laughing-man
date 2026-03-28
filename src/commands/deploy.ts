import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../pipeline/config.js";

interface DeployOptions {
  configDir: string;
}

export async function runDeploy(options: DeployOptions): Promise<void> {
  const { configDir } = options;

  const config = await loadConfig(configDir);

  const outputDir = join(configDir, "output");
  const websiteDir = join(outputDir, "website");
  if (!existsSync(websiteDir)) {
    throw new Error(
      `output/website/ not found. Run 'laughing-man build' first.`
    );
  }

  console.log(`Deploying to Cloudflare Pages (${config.web_hosting.project})...`);

  const proc = Bun.spawn([
    "bunx", "wrangler", "pages", "deploy", "website",
    `--project-name=${config.web_hosting.project}`,
  ], {
    cwd: outputDir,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(
      `wrangler pages deploy failed with exit code ${exitCode}.\n` +
      `If wrangler is not installed, run: bun add -D wrangler`
    );
  }

  console.log("Deploy complete.");
}
