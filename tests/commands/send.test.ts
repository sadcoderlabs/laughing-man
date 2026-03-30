import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const mockSendEmail = mock(async () => ({
  data: { id: "email_123" },
  error: null,
}));

mock.module("resend", () => ({
  Resend: class FakeResend {
    segments = {
      list: mock(async () => ({ data: { data: [] }, error: null })),
    };

    broadcasts = {
      list: mock(async () => ({ data: { data: [] }, error: null })),
      create: mock(async () => ({ data: { id: "broadcast_123" }, error: null })),
      send: mock(async () => ({ error: null })),
    };

    emails = {
      send: mockSendEmail,
    };

    constructor(_apiKey: string) {}
  },
}));

const { runSend } = await import("../../src/commands/send");

describe("runSend", () => {
  let tmpDir: string;
  let logs: string[];

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-send-test-"));
    mkdirSync(join(tmpDir, "issues"), { recursive: true });
    mkdirSync(join(tmpDir, "output", "email"), { recursive: true });

    writeFileSync(
      join(tmpDir, "laughing-man.yaml"),
      `
name: "Test Newsletter"
issues_dir: ./issues
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

    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-30\n---\n# Issue 1\n\nContent.\n",
    );

    writeFileSync(
      join(tmpDir, "output", "email", "1.html"),
      '<p>Footer <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>',
    );

    logs = [];
    spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });

    mockSendEmail.mockReset().mockImplementation(async () => ({
      data: { id: "email_123" },
      error: null,
    }));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mock.restore();
  });

  it("replaces the broadcast unsubscribe placeholder in test emails", async () => {
    await runSend({
      configDir: tmpDir,
      issueNumber: 1,
      yes: true,
      testAddress: "reader@example.com",
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "reader@example.com",
        html: '<p>Footer <a href="https://example.com/unsubscribe-test">Unsubscribe</a></p>',
      }),
    );
    expect(
      logs.some((line) => line.includes("Test email for issue #1 sent to reader@example.com")),
    ).toBe(true);
  });
});
