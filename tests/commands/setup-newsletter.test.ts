import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const mockSegmentsList = mock(async (..._args: any[]) => ({
  data: {
    object: "list" as const,
    has_more: false,
    data: [{ id: "seg_123", name: "General", created_at: "2026-03-30T00:00:00Z" }],
  },
  error: null,
})) as any;

const mockDomainsList = mock(async (..._args: any[]) => ({
  data: {
    object: "list" as const,
    has_more: false,
    data: [],
  },
  error: null,
})) as any;

const mockDomainsCreate = mock(async (..._args: any[]) => ({
  data: {
    id: "dom_new",
    name: "send.example.com",
    status: "not_started",
    created_at: "2026-03-30T00:00:00Z",
    region: "us-east-1",
    capabilities: {
      sending: "enabled" as const,
      receiving: "disabled" as const,
    },
    records: [],
  },
  error: null,
})) as any;

const mockDomainsGet = mock(async (..._args: any[]) => ({
  data: {
    object: "domain" as const,
    id: "dom_new",
    name: "send.example.com",
    status: "not_started",
    created_at: "2026-03-30T00:00:00Z",
    region: "us-east-1",
    capabilities: {
      sending: "enabled" as const,
      receiving: "disabled" as const,
    },
    records: [],
  },
  error: null,
})) as any;

const mockDomainsVerify = mock(async (..._args: any[]) => ({
  data: {
    object: "domain" as const,
    id: "dom_new",
  },
  error: null,
})) as any;

mock.module("resend", () => ({
  Resend: class FakeResend {
    segments = {
      list: mockSegmentsList,
    };

    domains = {
      list: mockDomainsList,
      create: mockDomainsCreate,
      get: mockDomainsGet,
      verify: mockDomainsVerify,
    };

    constructor(_apiKey: string) {}
  },
}));

const { runSetupNewsletter } = await import("../../src/commands/setup-newsletter");

function newsletterYaml(from = "Test <news@send.example.com>") {
  return `
name: "Test Newsletter"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: test-newsletter
email_hosting:
  from: "${from}"
  provider: resend
env:
  RESEND_API_KEY: "re_test_123"
`.trim();
}

describe("runSetupNewsletter", () => {
  let tmpDir: string;
  let logs: string[];
  let domainListArgs: unknown[];

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-setup-newsletter-"));
    logs = [];
    domainListArgs = [];

    writeFileSync(join(tmpDir, "laughing-man.yaml"), newsletterYaml());

    spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });

    mockSegmentsList.mockReset().mockImplementation(async () => ({
      data: {
        object: "list" as const,
        has_more: false,
        data: [{ id: "seg_123", name: "General", created_at: "2026-03-30T00:00:00Z" }],
      },
      error: null,
    }));

    mockDomainsList.mockReset().mockImplementation(async (options?: unknown) => {
      domainListArgs.push(options);
      return {
      data: {
        object: "list" as const,
        has_more: false,
        data: [{
          id: "dom_verified",
          name: "send.example.com",
          status: "verified",
          created_at: "2026-03-30T00:00:00Z",
          region: "us-east-1",
          capabilities: {
            sending: "enabled" as const,
            receiving: "disabled" as const,
          },
        }],
      },
      error: null,
    };
    });

    mockDomainsCreate.mockReset().mockImplementation(async () => ({
      data: {
        id: "dom_new",
        name: "send.example.com",
        status: "not_started",
        created_at: "2026-03-30T00:00:00Z",
        region: "us-east-1",
        capabilities: {
          sending: "enabled" as const,
          receiving: "disabled" as const,
        },
        records: [],
      },
      error: null,
    }));

    mockDomainsGet.mockReset().mockImplementation(async () => ({
      data: {
        object: "domain" as const,
        id: "dom_new",
        name: "send.example.com",
        status: "not_started",
        created_at: "2026-03-30T00:00:00Z",
        region: "us-east-1",
        capabilities: {
          sending: "enabled" as const,
          receiving: "disabled" as const,
        },
        records: [],
      },
      error: null,
    }));

    mockDomainsVerify.mockReset().mockImplementation(async () => ({
      data: {
        object: "domain" as const,
        id: "dom_new",
      },
      error: null,
    }));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mock.restore();
  });

  it("fails fast when the Resend API key is invalid", async () => {
    mockSegmentsList.mockReset().mockImplementation(async () => ({
      data: null,
      error: { message: "Invalid API key" },
    }));

    await expect(runSetupNewsletter({ configDir: tmpDir })).rejects.toThrow(
      /Failed to validate Resend API key: Invalid API key/,
    );
    expect(logs.some((line) => line.includes("Resend API key valid"))).toBe(false);
    expect(mockDomainsList).not.toHaveBeenCalled();
  });

  it("paginates domains and extracts the sender address from angle brackets", async () => {
    writeFileSync(
      join(tmpDir, "laughing-man.yaml"),
      newsletterYaml("Team @ Example <news@send.example.com>"),
    );

    mockDomainsList
      .mockReset()
      .mockImplementationOnce(async (options?: unknown) => {
        domainListArgs.push(options);
        return {
          data: {
            object: "list" as const,
            has_more: true,
            data: [{
              id: "dom_1",
              name: "other.example.com",
              status: "verified",
              created_at: "2026-03-30T00:00:00Z",
              region: "us-east-1",
              capabilities: {
                sending: "enabled" as const,
                receiving: "disabled" as const,
              },
            }],
          },
          error: null,
        };
      })
      .mockImplementationOnce(async (options?: unknown) => {
        domainListArgs.push(options);
        return {
          data: {
            object: "list" as const,
            has_more: false,
            data: [{
              id: "dom_2",
              name: "send.example.com",
              status: "verified",
              created_at: "2026-03-30T00:00:00Z",
              region: "us-east-1",
              capabilities: {
                sending: "enabled" as const,
                receiving: "disabled" as const,
              },
            }],
          },
          error: null,
        };
      });

    await runSetupNewsletter({ configDir: tmpDir });

    expect(mockDomainsList).toHaveBeenCalledTimes(2);
    expect(domainListArgs[0]).toEqual({ limit: 100 });
    expect(domainListArgs[1]).toEqual({ limit: 100, after: "dom_1" });
    expect(mockDomainsCreate).not.toHaveBeenCalled();
    expect(
      logs.some((line) => line.includes('Sender domain "send.example.com" exists (status: verified)')),
    ).toBe(true);
  });

  it("surfaces verification errors instead of claiming success", async () => {
    mockDomainsList.mockReset().mockImplementation(async () => ({
      data: {
        object: "list" as const,
        has_more: false,
        data: [{
          id: "dom_pending",
          name: "send.example.com",
          status: "not_started",
          created_at: "2026-03-30T00:00:00Z",
          region: "us-east-1",
          capabilities: {
            sending: "disabled" as const,
            receiving: "disabled" as const,
          },
        }],
      },
      error: null,
    }));

    mockDomainsGet.mockReset().mockImplementation(async () => ({
      data: {
        object: "domain" as const,
        id: "dom_pending",
        name: "send.example.com",
        status: "not_started",
        created_at: "2026-03-30T00:00:00Z",
        region: "us-east-1",
        capabilities: {
          sending: "disabled" as const,
          receiving: "disabled" as const,
        },
        records: [{
          record: "SPF" as const,
          type: "TXT" as const,
          name: "send.example.com",
          value: "v=spf1 include:amazonses.com ~all",
          ttl: "3600",
          status: "not_started" as const,
        }],
      },
      error: null,
    }));

    mockDomainsVerify.mockReset().mockImplementation(async () => ({
      data: null,
      error: { message: "Verification request failed" },
    }));

    await expect(runSetupNewsletter({ configDir: tmpDir })).rejects.toThrow(
      /Failed to trigger verification check for "send\.example\.com": Verification request failed/,
    );
    expect(logs.some((line) => line.includes("Verification check triggered."))).toBe(false);
    expect(mockSegmentsList).toHaveBeenCalledTimes(1);
  });
});
