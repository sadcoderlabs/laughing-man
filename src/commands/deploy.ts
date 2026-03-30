import { $ } from "bun";
import { runBuild } from "./build.js";

interface DeployOptions {
  configDir: string;
}

export async function runDeploy(options: DeployOptions): Promise<void> {
  const { configDir } = options;

  const { config, outputDir } = await runBuild({
    configDir,
    includeDrafts: false,
  });

  if (!config.env.CLOUDFLARE_API_TOKEN) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is not configured. Set CLOUDFLARE_API_TOKEN env var or add it to laughing-man.yaml.",
    );
  }

  const project = config.web_hosting.project;
  const token = config.env.CLOUDFLARE_API_TOKEN;

  console.log(`Deploying to Cloudflare Pages (${project})...`);

  const { exitCode } = await $`CLOUDFLARE_API_TOKEN=${token} bunx wrangler pages deploy website --project-name=${project}`
    .cwd(outputDir)
    .nothrow();

  if (exitCode !== 0) {
    throw new Error(
      `wrangler pages deploy failed with exit code ${exitCode}.\n` +
        `If wrangler is not installed, run: bun add -D wrangler`,
    );
  }

  console.log("Deploy complete.");
}
