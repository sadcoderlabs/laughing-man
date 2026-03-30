import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const mockLoadConfig = mock(async () => ({
  name: "Test Newsletter",
  description: "A test newsletter",
  url: "https://newsletter.example.com",
  issues_dir: "/tmp/issues",
  web_hosting: {
    provider: "cloudflare-pages",
    project: "test-newsletter",
  },
  email_hosting: {
    from: "Test <test@example.com>",
    provider: "resend",
  },
  env: {
    RESEND_API_KEY: "re_test_123",
  },
  configDir: "/tmp",
}));

const mockScanIssuesDir = mock(async () => ([
  {
    issue: 1,
    title: "Issue 1",
    status: "ready",
  },
]));

const mockSendEmail = mock(async () => "email_123");
const mockCreateResendProvider = mock(() => ({
  listSegments: mock(async () => []),
  listBroadcasts: mock(async () => []),
  createBroadcast: mock(async () => "broadcast_123"),
  sendBroadcast: mock(async () => {}),
  sendEmail: mockSendEmail,
}));

mock.module("../../src/pipeline/config", () => ({
  loadConfig: mockLoadConfig,
}));

mock.module("../../src/pipeline/markdown", () => ({
  scanIssuesDir: mockScanIssuesDir,
}));

mock.module("../../src/providers/resend", () => ({
  createResendProvider: mockCreateResendProvider,
}));

mock.module("resend", () => ({
  Resend: class FakeResend {
    constructor(_apiKey: string) {}
  },
}));

const { runSend } = await import("../../src/commands/send");

describe("runSend", () => {
  let tmpDir: string;
  let logs: string[];

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-send-test-"));
    mkdirSync(join(tmpDir, "output", "email"), { recursive: true });
    writeFileSync(
      join(tmpDir, "output", "email", "1.html"),
      '<p>Footer <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>',
    );

    logs = [];
    spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });

    mockLoadConfig.mockReset().mockImplementation(async () => ({
      name: "Test Newsletter",
      description: "A test newsletter",
      url: "https://newsletter.example.com",
      issues_dir: join(tmpDir, "issues"),
      web_hosting: {
        provider: "cloudflare-pages",
        project: "test-newsletter",
      },
      email_hosting: {
        from: "Test <test@example.com>",
        provider: "resend",
      },
      env: {
        RESEND_API_KEY: "re_test_123",
      },
      configDir: tmpDir,
    }));
    mockScanIssuesDir.mockReset().mockImplementation(async () => ([
      {
        issue: 1,
        title: "Issue 1",
        status: "ready",
      },
    ]));
    mockSendEmail.mockReset().mockImplementation(async () => "email_123");
    mockCreateResendProvider.mockReset().mockImplementation(() => ({
      listSegments: mock(async () => []),
      listBroadcasts: mock(async () => []),
      createBroadcast: mock(async () => "broadcast_123"),
      sendBroadcast: mock(async () => {}),
      sendEmail: mockSendEmail,
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
    expect(logs.some((line) => line.includes("Test email for issue #1 sent to reader@example.com"))).toBe(true);
  });
});
