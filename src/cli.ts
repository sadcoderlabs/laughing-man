#!/usr/bin/env bun
import { runInit } from "./commands/init.js";
import { runBuild } from "./commands/build.js";
import { runPreview } from "./commands/preview.js";
import { runDeploy } from "./commands/deploy.js";
import { runSend } from "./commands/send.js";
import { runSetupWeb } from "./commands/setup-web.js";

const args = process.argv.slice(2);
const configDir = process.cwd();

async function main(): Promise<void> {
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`laughing-man -- Turn your Markdown into a newsletter.

Commands:
  init              Generate laughing-man.yaml in the current directory
  setup web         Create Cloudflare Pages project + custom domain + DNS
  build             Validate + build site and email HTML
  preview           Build (including drafts) + start local preview server
    --no-drafts     Exclude drafts (show only published issues)
  deploy            Deploy output/website/ to Cloudflare Pages
  send <issue>      Send an issue via Resend Broadcast
    --yes           Skip confirmation prompt (for CI)

Examples:
  laughing-man init
  laughing-man setup web
  laughing-man build
  laughing-man preview
  laughing-man deploy
  laughing-man send 1
  laughing-man send 1 --yes
`);
    process.exit(0);
  }

  try {
    switch (command) {
      case "init": {
        await runInit(configDir);
        break;
      }

      case "build": {
        await runBuild({ configDir, includeDrafts: false });
        break;
      }

      case "preview": {
        const noDrafts = args.includes("--no-drafts");
        await runPreview({ configDir, includeDrafts: !noDrafts });
        break;
      }

      case "deploy": {
        await runDeploy({ configDir });
        break;
      }

      case "setup": {
        const subcommand = args[1];
        if (subcommand !== "web") {
          console.error(
            subcommand
              ? `Unknown setup subcommand: ${subcommand}`
              : "Usage: laughing-man setup web",
          );
          process.exit(1);
        }
        await runSetupWeb({ configDir });
        break;
      }

      case "send": {
        const issueArg = args[1];
        if (!issueArg || !/^\d+$/.test(issueArg)) {
          console.error("Usage: laughing-man send <issue-number> [--yes]");
          process.exit(1);
        }
        const yes = args.includes("--yes");
        await runSend({
          configDir,
          issueNumber: parseInt(issueArg, 10),
          yes,
        });
        break;
      }

      default: {
        console.error(`Unknown command: ${command}\nRun 'laughing-man --help' for usage.`);
        process.exit(1);
      }
    }
  } catch (err: unknown) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
