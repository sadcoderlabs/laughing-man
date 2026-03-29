import { loadConfig } from "../pipeline/config.js";
import {
  createClient,
  verifyAuth,
  ensureProject,
  ensureDomain,
  ensureDnsRecord,
} from "../pipeline/cloudflare.js";

interface SetupWebOptions {
  configDir: string;
}

export async function runSetupWeb(options: SetupWebOptions) {
  const config = await loadConfig(options.configDir);

  const apiToken = config.env.cloudflare_api_token;
  const accountId = config.env.cloudflare_account_id;

  if (!apiToken) {
    throw new Error(
      "Cloudflare API token not found. Set CLOUDFLARE_API_TOKEN env var or add cloudflare_api_token to laughing-man.yaml",
    );
  }
  if (!accountId) {
    throw new Error(
      "Cloudflare account ID not found. Set CLOUDFLARE_ACCOUNT_ID env var or add cloudflare_account_id to laughing-man.yaml",
    );
  }

  const client = createClient(apiToken);
  const projectName = config.web_hosting.project;
  const domain = config.web_hosting.domain;

  // Step 1: Verify auth
  await verifyAuth(client, accountId);
  console.log(`[ok] Cloudflare API token valid`);

  // Step 2: Ensure project
  const projectResult = await ensureProject(client, accountId, projectName);
  console.log(
    `[ok] Pages project "${projectName}" ${projectResult.created ? "created" : "exists"}`,
  );

  if (!domain) {
    console.log(
      `\nSetup complete. Run 'laughing-man build && laughing-man deploy' to publish.`,
    );
    return;
  }

  // Step 3: Ensure custom domain
  const domainResult = await ensureDomain(
    client,
    accountId,
    projectName,
    domain,
  );
  console.log(
    `[ok] Custom domain ${domain} ${domainResult.created ? "added to" : "already on"} Pages project "${projectName}"`,
  );

  // Step 4: Ensure DNS
  const target = `${projectName}.pages.dev`;
  const dnsResult = await ensureDnsRecord(client, domain, target);

  if (dnsResult.status === "managed_conflict") {
    console.log(
      `[!!] A DNS record managed by Cloudflare Workers or Pages already exists on ${domain}.`,
    );
    console.log(
      `     This may be from another project. To fix, either:`,
    );
    console.log(
      `     1. Remove the existing DNS record in the Cloudflare dashboard`,
    );
    console.log(
      `     2. Use a different domain or subdomain in laughing-man.yaml`,
    );
    console.log(
      `\n     Then re-run 'laughing-man setup web'.`,
    );
  } else if (dnsResult.status === "external") {
    console.log(`[!!] Domain ${domain} is not on Cloudflare DNS.`);
    console.log(`     Add this record with your DNS provider:\n`);
    console.log(
      `     Type   Name${" ".repeat(Math.max(1, 26 - domain.length))}Content`,
    );
    console.log(
      `     CNAME  ${domain}${" ".repeat(Math.max(1, 26 - domain.length))}${target}`,
    );
    console.log(`\n     Then re-run 'laughing-man setup web' to verify.`);
  } else if (dnsResult.status === "created") {
    console.log(`[ok] DNS CNAME record created (${domain} -> ${target})`);
    console.log(
      `\nSetup complete. Run 'laughing-man build && laughing-man deploy' to publish.`,
    );
  } else {
    console.log(`[ok] DNS CNAME record exists (${domain} -> ${target})`);
    console.log(`\nNothing to do. Everything is already set up.`);
  }
}
