import { spawnSync } from "node:child_process";
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

  console.log(`Deploying to Cloudflare Pages (${project})...`);

  const result = spawnSync(
    "npx",
    ["--yes", "wrangler", "pages", "deploy", "website", `--project-name=${project}`, "--commit-dirty=true", "--branch=main"],
    {
      cwd: outputDir,
      stdio: "inherit",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: config.env.CLOUDFLARE_API_TOKEN },
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `wrangler pages deploy failed with exit code ${result.status}.\n` +
        `If wrangler is not installed, run: npm install -D wrangler`,
    );
  }

  console.log(`Deploy complete: ${config.url}`);
}
