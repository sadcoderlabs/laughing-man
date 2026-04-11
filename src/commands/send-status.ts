import { Resend } from "resend";
import { loadConfig } from "../pipeline/config.js";
import { createResendProvider } from "../providers/resend.js";

interface SendStatusOptions {
  configDir: string;
}

const EVENT_TYPES = [
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "delivery_delayed",
  "failed",
] as const;

function extractIssueNumber(subject: string): number | null {
  const match = subject.match(/Issue #(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export async function runSendStatus(options: SendStatusOptions): Promise<void> {
  const config = await loadConfig(options.configDir);

  const apiKey = config.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Set RESEND_API_KEY env var or add it to laughing-man.yaml.",
    );
  }

  const resend = new Resend(apiKey);
  const provider = createResendProvider(resend);

  const [segments, broadcasts, emails, contacts] = await Promise.all([
    provider.listSegments(),
    provider.listBroadcasts(),
    provider.listEmails(),
    provider.listContacts(),
  ]);

  // Audience line
  const segmentName = segments[0]?.name ?? "Unknown";
  const totalContacts = contacts.length;
  const unsubscribed = contacts.filter((c) => c.unsubscribed).length;
  console.log(`Audience: ${segmentName} (${totalContacts} subscribers, ${unsubscribed} unsubscribed)`);

  if (broadcasts.length === 0) {
    console.log("\nNo broadcasts found.");
    return;
  }

  // Group emails by issue number
  const emailsByIssue = new Map<number, typeof emails>();
  for (const email of emails) {
    const issueNum = extractIssueNumber(email.subject);
    if (issueNum === null) continue;
    const group = emailsByIssue.get(issueNum);
    if (group) {
      group.push(email);
    } else {
      emailsByIssue.set(issueNum, [email]);
    }
  }

  // Sort broadcasts newest first by sent_at
  const sorted = [...broadcasts]
    .filter((b) => b.sent_at)
    .sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime());

  // Find the longest event type name for alignment
  const maxLabelLen = Math.max(...EVENT_TYPES.map((e) => e.length));

  for (const broadcast of sorted) {
    const issueMatch = broadcast.name.match(/Issue #(\d+)/);
    if (!issueMatch) continue;
    const issueNum = parseInt(issueMatch[1], 10);

    console.log(`\n=== ${broadcast.name} ===`);
    console.log(`Sent: ${broadcast.sent_at}`);

    const issueEmails = emailsByIssue.get(issueNum) ?? [];
    console.log(`Recipients: ${issueEmails.length}`);

    // Count events
    const counts = new Map<string, number>();
    for (const type of EVENT_TYPES) counts.set(type, 0);
    for (const email of issueEmails) {
      const current = counts.get(email.last_event) ?? 0;
      counts.set(email.last_event, current + 1);
    }

    // Find max count width for right-alignment
    const maxCountLen = Math.max(...[...counts.values()].map((v) => String(v).length));

    for (const type of EVENT_TYPES) {
      const count = counts.get(type) ?? 0;
      const label = `${type}:`.padEnd(maxLabelLen + 1);
      const value = String(count).padStart(maxCountLen);
      console.log(`  ${label} ${value}`);
    }

    // List bounced addresses
    const bounced = issueEmails.filter((e) => e.last_event === "bounced");
    if (bounced.length > 0) {
      console.log("\n  Bounced:");
      for (const e of bounced) {
        console.log(`    - ${e.to[0]}`);
      }
    }

    // List complained addresses
    const complained = issueEmails.filter((e) => e.last_event === "complained");
    if (complained.length > 0) {
      console.log("\n  Complained:");
      for (const e of complained) {
        console.log(`    - ${e.to[0]}`);
      }
    }
  }
}
