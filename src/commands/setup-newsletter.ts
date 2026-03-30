import { Resend } from "resend";
import { loadConfig } from "../pipeline/config.js";

interface SetupNewsletterOptions {
  configDir: string;
}

function extractDomain(fromAddress: string): string {
  const address =
    fromAddress.match(/<\s*([^<>]+)\s*>/)?.[1]?.trim() ??
    fromAddress.trim();

  const match = address.match(/^[^@\s]+@([^@\s]+)$/);
  if (!match) {
    throw new Error(
      `Could not extract domain from email_hosting.from: "${fromAddress}". ` +
        `Expected format: "Name <user@domain.com>" or "user@domain.com"`,
    );
  }
  return match[1].toLowerCase();
}

function requireSuccess<T>(
  response: { data: T | null; error: { message: string } | null },
  action: string,
): T {
  if (response.error) {
    throw new Error(`Failed to ${action}: ${response.error.message}`);
  }
  if (!response.data) {
    throw new Error(`Failed to ${action}: Resend returned no data`);
  }
  return response.data;
}

async function findDomainByName(
  resend: Resend,
  domainName: string,
): Promise<{ id: string; name: string; status: string } | null> {
  let after: string | undefined;

  while (true) {
    const page = requireSuccess(
      await resend.domains.list(after ? { limit: 100, after } : { limit: 100 }),
      "list Resend domains",
    );

    const existing = page.data.find(
      (domain) => domain.name.toLowerCase() === domainName,
    );
    if (existing) {
      return existing;
    }

    if (!page.has_more || page.data.length === 0) {
      return null;
    }

    after = page.data[page.data.length - 1]!.id;
  }
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
  requireSuccess(
    await resend.segments.list({ limit: 1 }),
    "validate Resend API key",
  );
  console.log("[ok] Resend API key valid");

  // Step 2: Check/create sender domain
  const senderDomain = extractDomain(config.email_hosting.from);
  const existing = await findDomainByName(resend, senderDomain);

  let domainId: string;
  let domainStatus: string;

  if (existing) {
    domainId = existing.id;
    domainStatus = existing.status;
    console.log(
      `[ok] Sender domain "${senderDomain}" exists (status: ${domainStatus})`,
    );
  } else {
    const createData = requireSuccess(
      await resend.domains.create({ name: senderDomain }),
      `create sender domain "${senderDomain}"`,
    );
    domainId = createData.id;
    domainStatus = createData.status;
    console.log(`[ok] Sender domain "${senderDomain}" created`);
  }

  // Step 3: If not verified, fetch domain details and print DNS records
  if (domainStatus !== "verified") {
    const domainDetail = requireSuccess(
      await resend.domains.get(domainId),
      `get sender domain "${senderDomain}"`,
    );

    const records = domainDetail.records ?? [];

    if (records.length > 0) {
      console.log(
        `\n[!!] Domain "${senderDomain}" is not yet verified. Add these DNS records:\n`,
      );
      console.log(
        `     ${"Type".padEnd(8)}${"Name".padEnd(40)}${"Value"}`,
      );
      console.log(`     ${"─".repeat(8)}${"─".repeat(40)}${"─".repeat(40)}`);
      for (const r of records) {
        const type = r.type.toUpperCase();
        const name = r.name;
        const value = r.value;
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
    const verifyResponse = await resend.domains.verify(domainId);
    if (verifyResponse.error) {
      throw new Error(
        `Failed to trigger verification check for "${senderDomain}": ${verifyResponse.error.message}`,
      );
    }
    console.log(`     Verification check triggered.`);
  } else {
    console.log(`[ok] Sender domain "${senderDomain}" is verified`);
  }

  // Step 4: Check that at least one segment exists
  const segData = requireSuccess(
    await resend.segments.list({ limit: 100 }),
    "list Resend segments",
  );
  const segments = segData.data ?? [];

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
