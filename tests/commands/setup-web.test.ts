import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

// Mock the cloudflare module before importing setup-web
const mockDiscoverAccountId = mock(() => Promise.resolve("acc_123"));
const mockEnsureProject = mock(() => Promise.resolve({ created: true }));
const mockEnsureDomain = mock(() => Promise.resolve({ created: true }));
const mockEnsureDnsRecord = mock((): Promise<{ status: string; domain?: string; target?: string }> =>
  Promise.resolve({ status: "created" }),
);
const mockCreateClient = mock(() => ({}));

mock.module("../../src/pipeline/cloudflare", () => ({
  createClient: mockCreateClient,
  discoverAccountId: mockDiscoverAccountId,
  ensureProject: mockEnsureProject,
  ensureDomain: mockEnsureDomain,
  ensureDnsRecord: mockEnsureDnsRecord,
}));

const { runSetupWeb } = await import("../../src/commands/setup-web");

function minimalYaml(overrides: {
  domain?: string;
  env?: Record<string, string>;
} = {}) {
  const domain = overrides.domain ? `\n  domain: ${overrides.domain}` : "";
  const env = overrides.env ?? {
    cloudflare_api_token: "cf_test",
  };
  const envLines = Object.entries(env)
    .map(([k, v]) => `  ${k}: "${v}"`)
    .join("\n");

  return `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-project${domain}
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env:
${envLines}
`.trim();
}

describe("runSetupWeb", () => {
  let tmpDir: string;
  let logs: string[];

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-setup-web-"));
    logs = [];
    spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.join(" "));
    });
    mockDiscoverAccountId.mockReset().mockImplementation(() => Promise.resolve("acc_123"));
    mockEnsureProject.mockReset().mockImplementation(() => Promise.resolve({ created: true }));
    mockEnsureDomain.mockReset().mockImplementation(() => Promise.resolve({ created: true }));
    mockEnsureDnsRecord.mockReset().mockImplementation(() =>
      Promise.resolve({ status: "created" }),
    );
    mockCreateClient.mockReset().mockImplementation(() => ({}));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mock.restore();
  });

  it("throws when cloudflare_api_token is missing", async () => {
    writeFileSync(
      join(tmpDir, "laughing-man.yaml"),
      minimalYaml({ env: { resend_api_key: "re_test" } }),
    );
    await expect(runSetupWeb({ configDir: tmpDir })).rejects.toThrow(
      /Cloudflare API token not found/,
    );
  });

  it("runs all steps for project without custom domain", async () => {
    writeFileSync(join(tmpDir, "laughing-man.yaml"), minimalYaml());

    await runSetupWeb({ configDir: tmpDir });

    expect(mockDiscoverAccountId).toHaveBeenCalledTimes(1);
    expect(mockEnsureProject).toHaveBeenCalledTimes(1);
    expect(mockEnsureDomain).not.toHaveBeenCalled();
    expect(mockEnsureDnsRecord).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("[ok]") && l.includes("token valid"))).toBe(true);
    expect(logs.some((l) => l.includes("[ok]") && l.includes("my-project"))).toBe(true);
  });

  it("runs domain + DNS steps when domain is configured", async () => {
    writeFileSync(
      join(tmpDir, "laughing-man.yaml"),
      minimalYaml({ domain: "newsletter.example.com" }),
    );

    await runSetupWeb({ configDir: tmpDir });

    expect(mockEnsureDomain).toHaveBeenCalledTimes(1);
    expect(mockEnsureDnsRecord).toHaveBeenCalledTimes(1);
  });

  it("prints external DNS instructions when zone not on Cloudflare", async () => {
    writeFileSync(
      join(tmpDir, "laughing-man.yaml"),
      minimalYaml({ domain: "newsletter.example.com" }),
    );
    mockEnsureDnsRecord.mockReset().mockImplementation(() =>
      Promise.resolve({
        status: "external",
        domain: "newsletter.example.com",
        target: "my-project.pages.dev",
      }),
    );

    await runSetupWeb({ configDir: tmpDir });

    expect(logs.some((l) => l.includes("[!!]") && l.includes("not on Cloudflare DNS"))).toBe(true);
    expect(logs.some((l) => l.includes("CNAME"))).toBe(true);
  });
});
