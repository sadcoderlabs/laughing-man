import Cloudflare from "cloudflare";

export function createClient(apiToken: string) {
  return new Cloudflare({ apiToken });
}

export function extractApexDomain(domain: string) {
  const parts = domain.split(".");
  return parts.slice(-2).join(".");
}

export async function discoverAccountId(client: Cloudflare) {
  const accounts = [];
  for await (const account of client.accounts.list()) {
    accounts.push(account);
  }

  if (accounts.length === 0) {
    throw new Error(
      "No Cloudflare accounts found for this API token. Check that the token has the correct permissions.",
    );
  }
  if (accounts.length > 1) {
    const names = accounts.map((a) => `  - ${a.name} (${a.id})`).join("\n");
    throw new Error(
      `Multiple Cloudflare accounts found. Set CLOUDFLARE_ACCOUNT_ID to pick one:\n${names}`,
    );
  }

  return accounts[0].id;
}

export async function ensureProject(
  client: Cloudflare,
  accountId: string,
  projectName: string,
) {
  try {
    await client.pages.projects.get(projectName, { account_id: accountId });
    return { created: false };
  } catch (err) {
    if (err instanceof Cloudflare.APIError && err.status === 404) {
      await client.pages.projects.create({
        account_id: accountId,
        name: projectName,
        production_branch: "main",
      });
      return { created: true };
    }
    throw err;
  }
}

export async function upsertProjectSecret(
  client: Cloudflare,
  accountId: string,
  projectName: string,
  secretName: string,
  secretValue: string,
) {
  let project;
  try {
    project = await client.pages.projects.get(projectName, {
      account_id: accountId,
    });
  } catch (err) {
    if (err instanceof Cloudflare.APIError && err.status === 404) {
      throw new Error(`Pages project "${projectName}" not found`);
    }
    throw err;
  }

  const deploymentConfigs = project.deployment_configs ?? {};
  const production = deploymentConfigs.production ?? {};
  const productionEnvVars = production.env_vars ?? {};

  await client.pages.projects.edit(projectName, {
    account_id: accountId,
    deployment_configs: {
      ...deploymentConfigs,
      production: {
        ...production,
        env_vars: {
          ...productionEnvVars,
          [secretName]: {
            type: "secret_text",
            value: secretValue,
          },
        },
      },
    },
  });
}

export async function ensureDomain(
  client: Cloudflare,
  accountId: string,
  projectName: string,
  domain: string,
) {
  const domains = client.pages.projects.domains.list(projectName, {
    account_id: accountId,
  });
  for await (const d of domains) {
    if (d.name === domain) return { created: false };
  }

  await client.pages.projects.domains.create(projectName, {
    account_id: accountId,
    name: domain,
  });
  return { created: true };
}

export type DnsResult =
  | { status: "created" }
  | { status: "exists" }
  | { status: "managed_conflict"; domain: string; target: string }
  | { status: "external"; domain: string; target: string };

export async function ensureDnsRecord(
  client: Cloudflare,
  domain: string,
  target: string,
): Promise<DnsResult> {
  const apex = extractApexDomain(domain);

  // Find zone for the apex domain
  let zoneId: string | undefined;
  for await (const zone of client.zones.list({ name: apex })) {
    zoneId = zone.id;
    break;
  }

  if (!zoneId) {
    return { status: "external", domain, target };
  }

  // Check for existing CNAME
  for await (const record of client.dns.records.list({
    zone_id: zoneId,
    type: "CNAME",
    name: { exact: domain },
  })) {
    if (record.type === "CNAME" && record.name === domain) {
      return { status: "exists" };
    }
  }

  // Create CNAME record
  try {
    await client.dns.records.create({
      zone_id: zoneId,
      type: "CNAME",
      name: domain,
      content: target,
      ttl: 1,
      proxied: true,
    });
    return { status: "created" };
  } catch (err) {
    // A managed DNS record (from Workers or another Pages project) already exists on this host
    if (
      err instanceof Cloudflare.APIError &&
      err.errors?.some((e) => e.code === 81062)
    ) {
      return { status: "managed_conflict", domain, target };
    }
    throw err;
  }
}
