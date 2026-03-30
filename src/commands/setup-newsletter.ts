import { Resend } from "resend";
import { loadConfig } from "../pipeline/config.js";

interface SetupNewsletterOptions {
  configDir: string;
}

function extractDomain(fromAddress: string): string {
  // "Name <user@domain.com>" -> "domain.com"
  const match = fromAddress.match(/@([^>]+)/);
  if (!match) {
    throw new Error(
      `Could not extract domain from email_hosting.from: "${fromAddress}". ` +
        `Expected format: "Name <user@domain.com>"`,
    );
  }
  return match[1];
}

export async function runSetupNewsletter(
  options: SetupNewsletterOptions,
): Promise<void> {
  const config = await loadConfig(options.configDir);

  const apiKey = config.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Resend API key not found. Set RESEND_API_KEY env var or add it to laughing-man.yaml",
    );
  }

  const resend = new Resend(apiKey);

  // Step 1: Validate API key by listing segments
  try {
    await resend.segments.list();
  } catch (err) {
    throw new Error(
      `Resend API key is invalid or lacks permissions. ${(err as Error).message}`,
    );
  }
  console.log("[ok] Resend API key valid");

  // Step 2: Check/create sender domain
  const senderDomain = extractDomain(config.email_hosting.from);

  const { data: domainsData, error: domainsError } =
    await resend.domains.list();
  if (domainsError) {
    throw new Error(`Failed to list Resend domains: ${domainsError.message}`);
  }

  const domains = domainsData?.data ?? [];
  const existing = domains.find(
    (d) => d.name === senderDomain,
  );

  let domainId: string;
  let domainStatus: string;

  if (existing) {
    domainId = existing.id;
    domainStatus = existing.status;
    console.log(
      `[ok] Sender domain "${senderDomain}" exists (status: ${domainStatus})`,
    );
  } else {
    const { data: createData, error: createError } =
      await resend.domains.create({ name: senderDomain });
    if (createError) {
      throw new Error(
        `Failed to create sender domain "${senderDomain}": ${createError.message}`,
      );
    }
    domainId = createData!.id;
    domainStatus = createData!.status;
    console.log(`[ok] Sender domain "${senderDomain}" created`);
  }

  // Step 3: If not verified, fetch domain details and print DNS records
  if (domainStatus !== "verified") {
    const { data: domainDetail, error: detailError } =
      await resend.domains.get(domainId);
    if (detailError) {
      throw new Error(
        `Failed to get domain details: ${detailError.message}`,
      );
    }

    const records = (domainDetail as any)?.records ?? [];

    if (records.length > 0) {
      console.log(
        `\n[!!] Domain "${senderDomain}" is not yet verified. Add these DNS records:\n`,
      );
      console.log(
        `     ${"Type".padEnd(8)}${"Name".padEnd(40)}${"Value"}`,
      );
      console.log(`     ${"─".repeat(8)}${"─".repeat(40)}${"─".repeat(40)}`);
      for (const r of records) {
        const type = (r.type ?? r.record_type ?? "").toUpperCase();
        const name = r.name ?? r.host ?? "";
        const value = r.value ?? r.data ?? "";
        const priority = r.priority != null ? ` (priority: ${r.priority})` : "";
        console.log(
          `     ${type.padEnd(8)}${name.padEnd(40)}${value}${priority}`,
        );
      }
      console.log(
        `\n     After adding records, re-run 'laughing-man setup newsletter' to verify.`,
      );
    } else {
      console.log(
        `\n[!!] Domain "${senderDomain}" status: ${domainStatus}. ` +
          `Check https://resend.com/domains for DNS records to add.`,
      );
    }

    // Trigger verification attempt
    try {
      await resend.domains.verify(domainId);
      console.log(`     Verification check triggered.`);
    } catch {
      // Verification is async, ignore errors
    }
  } else {
    console.log(`[ok] Sender domain "${senderDomain}" is verified`);
  }

  // Step 4: Check that at least one segment exists
  const { data: segData, error: segError } = await resend.segments.list();
  if (segError) {
    throw new Error(`Failed to list segments: ${segError.message}`);
  }
  const segments = segData?.data ?? [];

  if (segments.length === 0) {
    console.log(
      `\n[!!] No segments found. Create one at https://resend.com/audiences`,
    );
    console.log(
      `     The 'send' command needs at least one segment to target.`,
    );
  } else if (segments.length === 1) {
    console.log(
      `[ok] Segment "${segments[0].name}" found (${segments[0].id})`,
    );
  } else {
    console.log(`[ok] ${segments.length} segments found`);
    for (const s of segments) {
      console.log(`     - ${s.name} (${s.id})`);
    }
  }

  // Step 5: Remind about Pages secret
  const project = config.web_hosting.project;
  if (domainStatus === "verified") {
    console.log(
      `\nSetup complete. If you haven't already, set the Resend API key as a Pages secret:`,
    );
  } else {
    console.log(
      `\nOnce the domain is verified, set the Resend API key as a Pages secret:`,
    );
  }
  console.log(
    `  bunx wrangler pages secret put RESEND_API_KEY --project-name ${project}`,
  );
  console.log(
    `\nThis allows the subscribe form to work in production.`,
  );
}
