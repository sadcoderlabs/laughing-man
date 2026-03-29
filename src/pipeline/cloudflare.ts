import Cloudflare from "cloudflare";

export function createClient(apiToken: string) {
  return new Cloudflare({ apiToken });
}

export function extractApexDomain(domain: string) {
  const parts = domain.split(".");
  return parts.slice(-2).join(".");
}

export async function verifyAuth(client: Cloudflare, accountId: string) {
  // List Pages projects to verify token + account ID without needing Account Settings Read
  await client.pages.projects.list({ account_id: accountId });
  return accountId;
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
