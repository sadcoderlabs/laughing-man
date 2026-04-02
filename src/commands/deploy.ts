import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { runBuild } from "./build.js";

interface DeployOptions {
  configDir: string;
}

function findPackageRoot(fromDir: string): string {
  let currentDir = fromDir;
  const { root } = parse(fromDir);

  while (true) {
    if (existsSync(join(currentDir, "package.json"))) {
      return currentDir;
    }

    if (currentDir === root) {
      throw new Error(`Could not locate package.json from ${fromDir}`);
    }

    currentDir = dirname(currentDir);
  }
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

  const packageRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)));
  const packageBinDir = join(packageRoot, "node_modules", ".bin");
  const wranglerCommand = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
  const result = spawnSync(
    wranglerCommand,
    ["pages", "deploy", "website", `--project-name=${project}`, "--commit-dirty=true", "--branch=main"],
    {
      cwd: outputDir,
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${packageBinDir}${delimiter}${process.env.PATH ?? ""}`,
        CLOUDFLARE_API_TOKEN: config.env.CLOUDFLARE_API_TOKEN,
        WRANGLER_HIDE_BANNER: "true", // Wrangler's startup banner triggers an npm registry update check.
      },
    },
  );

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "Bundled wrangler executable was not found. Reinstall @sadcoderlabs/laughing-man.",
      );
    }

    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `wrangler pages deploy failed with exit code ${result.status}.`,
    );
  }

  console.log(`Deploy complete: ${config.url}`);
}
