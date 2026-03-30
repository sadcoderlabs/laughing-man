#!/usr/bin/env bun
import { runInit } from "./commands/init.js";
import { runBuild } from "./commands/build.js";
import { runPreview } from "./commands/preview.js";
import { runDeploy } from "./commands/deploy.js";
import { runSend } from "./commands/send.js";
import { runSetupWeb } from "./commands/setup-web.js";

const args = process.argv.slice(2);
const configDir = process.cwd();
const wantsHelp = args.includes("--help") || args.includes("-h");

function showHelp(text: string): never {
  console.log(text);
  process.exit(0);
}

async function main(): Promise<void> {
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    showHelp(`laughing-man -- Turn your Markdown into a newsletter.

Commands:
  init              Generate laughing-man.yaml in the current directory
  setup web         Create Cloudflare Pages project + custom domain + DNS
  build             Validate + build site and email HTML
  preview           Build (including drafts) + start local preview server
  deploy            Deploy output/website/ to Cloudflare Pages
  send <issue>      Send an issue via Resend Broadcast

Run 'laughing-man <command> --help' for command-specific options.
`);
  }

  try {
    switch (command) {
      case "init": {
        if (wantsHelp) {
          showHelp(`Usage: laughing-man init

Generate a laughing-man.yaml config file in the current directory.
`);
        }
        await runInit(configDir);
        break;
      }

      case "build": {
        if (wantsHelp) {
          showHelp(`Usage: laughing-man build

Validate all issues and generate site + email HTML.
Drafts are excluded from the output.
`);
        }
        await runBuild({ configDir, includeDrafts: false });
        break;
      }

      case "preview": {
        if (wantsHelp) {
          showHelp(`Usage: laughing-man preview [options]

Build (including drafts) and start a local preview server.

Options:
  --production    Build as production (exclude drafts, show teasers)
  --no-drafts     Alias for --production
`);
        }
        const noDrafts = args.includes("--no-drafts") || args.includes("--production");
        await runPreview({ configDir, includeDrafts: !noDrafts });
        break;
      }

      case "deploy": {
        if (wantsHelp) {
          showHelp(`Usage: laughing-man deploy

Deploy output/website/ to Cloudflare Pages.
Runs a clean build first to ensure drafts are never included.
`);
        }
        await runDeploy({ configDir });
        break;
      }

      case "setup": {
        const subcommand = args[1];
        if (wantsHelp || subcommand !== "web") {
          showHelp(`Usage: laughing-man setup web

Create a Cloudflare Pages project with custom domain and DNS.
`);
        }
        await runSetupWeb({ configDir });
        break;
      }

      case "send": {
        if (wantsHelp) {
          showHelp(`Usage: laughing-man send <issue-number> [options]

Send an issue via Resend Broadcast.

Options:
  --yes           Skip confirmation prompt (for CI)
`);
        }
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
