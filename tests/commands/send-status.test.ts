import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const mockEmailsList = mock(async () => ({
  data: {
    object: "list",
    has_more: false,
    data: [
      { id: "e1", to: ["alice@test.com"], subject: "Issue #2 Hello", last_event: "delivered" },
      { id: "e2", to: ["bob@test.com"], subject: "Issue #2 Hello", last_event: "bounced" },
      { id: "e3", to: ["carol@test.com"], subject: "Issue #1 World", last_event: "delivered" },
    ],
  },
  error: null,
}));

const mockContactsList = mock(async () => ({
  data: {
    object: "list",
    has_more: false,
    data: [
      { id: "c1", email: "alice@test.com", unsubscribed: false },
      { id: "c2", email: "bob@test.com", unsubscribed: false },
      { id: "c3", email: "carol@test.com", unsubscribed: true },
    ],
  },
  error: null,
}));

mock.module("resend", () => ({
  Resend: class FakeResend {
    segments = {
      list: mock(async () => ({
        data: { data: [{ id: "seg_1", name: "General" }] },
        error: null,
      })),
    };

    broadcasts = {
      list: mock(async () => ({
        data: {
          data: [
            { id: "b1", name: "Issue #1", status: "sent", sent_at: "2026-03-31 10:17:05+00", created_at: "2026-03-31 10:16:48+00", scheduled_at: null },
            { id: "b2", name: "Issue #2", status: "sent", sent_at: "2026-04-11 21:13:42+00", created_at: "2026-04-11 21:13:28+00", scheduled_at: null },
          ],
        },
        error: null,
      })),
    };

    emails = { list: mockEmailsList };

    contacts = { list: mockContactsList };

    constructor(_apiKey: string) {}
  },
}));

const { runSendStatus } = await import("../../src/commands/send-status");

describe("runSendStatus", () => {
  let tmpDir: string;
  let logs: string[];

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-send-status-test-"));

    writeFileSync(
      join(tmpDir, "laughing-man.yaml"),
      `
name: "Test Newsletter"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: test-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env:
  RESEND_API_KEY: "re_test_123"
`.trim(),
    );

    logs = [];
    spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mock.restore();
  });

  it("prints audience line with subscriber counts", async () => {
    await runSendStatus({ configDir: tmpDir });
    expect(logs.some((l) => l.includes("Audience: General") && l.includes("3 subscribers") && l.includes("1 unsubscribed"))).toBe(true);
  });

  it("prints broadcast sections newest first", async () => {
    await runSendStatus({ configDir: tmpDir });
    const output = logs.join("\n");
    const issue2Pos = output.indexOf("=== Issue #2 ===");
    const issue1Pos = output.indexOf("=== Issue #1 ===");
    expect(issue2Pos).toBeGreaterThan(-1);
    expect(issue1Pos).toBeGreaterThan(-1);
    expect(issue2Pos).toBeLessThan(issue1Pos);
  });

  it("shows per-recipient event counts", async () => {
    await runSendStatus({ configDir: tmpDir });
    const output = logs.join("\n");
    expect(output).toContain("delivered:");
    expect(output).toContain("bounced:");
  });

  it("lists bounced addresses", async () => {
    await runSendStatus({ configDir: tmpDir });
    const output = logs.join("\n");
    expect(output).toContain("bob@test.com");
  });

  it("prints sent_at timestamp for each broadcast", async () => {
    await runSendStatus({ configDir: tmpDir });
    const output = logs.join("\n");
    expect(output).toContain("Sent:");
  });
});
