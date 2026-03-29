import Cloudflare from "cloudflare";

export function createClient(apiToken: string) {
  return new Cloudflare({ apiToken });
}

export function extractApexDomain(domain: string) {
  const parts = domain.split(".");
  return parts.slice(-2).join(".");
}

export async function verifyAuth(client: Cloudflare, accountId: string) {
  const account = await client.accounts.get({ account_id: accountId });
  return account.name;
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
    if (err instanceof Error && "status" in err && err.status === 404) {
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
  await client.dns.records.create({
    zone_id: zoneId,
    type: "CNAME",
    name: domain,
    content: target,
    ttl: 1,
    proxied: true,
  });
  return { status: "created" };
}
