import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "../../src/pipeline/config";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import os from "node:os";

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads a valid config file", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env:
  resend_api_key: "re_test"
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    const config = await loadConfig(tmpDir);

    expect(config.name).toBe("Test Newsletter");
    expect(config.url).toBe("https://example.com");
    expect(config.issues_dir).toBe(tmpDir); // resolved to absolute
    expect(config.env.resend_api_key).toBe("re_test");
    expect(config.configDir).toBe(tmpDir);
  });

  it("env vars override config values", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env:
  resend_api_key: "re_from_config"
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    process.env.RESEND_API_KEY = "re_from_env";

    try {
      const config = await loadConfig(tmpDir);
      expect(config.env.resend_api_key).toBe("re_from_env");
    } finally {
      delete process.env.RESEND_API_KEY;
    }
  });

  it("loads .env file from config directory", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);
    writeFileSync(join(tmpDir, ".env"), "RESEND_API_KEY=re_from_dotenv\n");

    const config = await loadConfig(tmpDir);

    expect(config.env.resend_api_key).toBe("re_from_dotenv");
  });

  it("throws if laughing-man.yaml is missing", async () => {
    await expect(loadConfig(tmpDir)).rejects.toThrow("laughing-man.yaml");
  });

  it("throws on missing required field", async () => {
    writeFileSync(join(tmpDir, "laughing-man.yaml"), "name: Only Name\n");
    await expect(loadConfig(tmpDir)).rejects.toThrow();
  });

  it("parses optional web_hosting.domain field", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
  domain: newsletter.example.com
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    const config = await loadConfig(tmpDir);
    expect(config.web_hosting.domain).toBe("newsletter.example.com");
  });

  it("parses Cloudflare credentials from config", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env:
  cloudflare_api_token: "cf_test_token"
  cloudflare_account_id: "abc123"
  resend_api_key: "re_test"
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    const config = await loadConfig(tmpDir);
    expect(config.env.cloudflare_api_token).toBe("cf_test_token");
    expect(config.env.cloudflare_account_id).toBe("abc123");
  });

  it("Cloudflare env vars override config values", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env:
  cloudflare_api_token: "cf_from_config"
  cloudflare_account_id: "id_from_config"
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    process.env.CLOUDFLARE_API_TOKEN = "cf_from_env";
    process.env.CLOUDFLARE_ACCOUNT_ID = "id_from_env";

    try {
      const config = await loadConfig(tmpDir);
      expect(config.env.cloudflare_api_token).toBe("cf_from_env");
      expect(config.env.cloudflare_account_id).toBe("id_from_env");
    } finally {
      delete process.env.CLOUDFLARE_API_TOKEN;
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    }
  });

  it("Cloudflare credentials load from .env file", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);
    writeFileSync(
      join(tmpDir, ".env"),
      "CLOUDFLARE_API_TOKEN=cf_from_dotenv\nCLOUDFLARE_ACCOUNT_ID=id_from_dotenv\n",
    );

    const config = await loadConfig(tmpDir);
    expect(config.env.cloudflare_api_token).toBe("cf_from_dotenv");
    expect(config.env.cloudflare_account_id).toBe("id_from_dotenv");
  });

  it("domain field is optional and defaults to undefined", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    const config = await loadConfig(tmpDir);
    expect(config.web_hosting.domain).toBeUndefined();
  });

  it("resolves attachments_dir relative to config dir", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
attachments_dir: ../Attachments
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    const config = await loadConfig(tmpDir);
    expect(config.attachments_dir).toBe(resolve(tmpDir, "../Attachments"));
  });
});
