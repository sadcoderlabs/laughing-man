import { readFileSync, existsSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { z } from "zod";
import type { SiteConfig } from "../types.js";

const ConfigSchema = z.object({
  name: z.string(),
  url: z.url(),
  issues_dir: z.string().default("."),
  attachments_dir: z.string().optional(),
  web_hosting: z.object({
    provider: z.literal("cloudflare-pages"),
    project: z.string(),
  }),
  email_hosting: z.object({
    from: z.string(),
    reply_to: z.string().optional(),
    provider: z.literal("resend"),
  }),
  env: z.object({
    resend_api_key: z.string().optional(),
    resend_audience_id: z.string().optional(),
  }).default({}),
});

function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

export async function loadConfig(configDir: string): Promise<SiteConfig> {
  configDir = resolve(configDir);
  const yamlPath = join(configDir, "laughing-man.yaml");

  if (!existsSync(yamlPath)) {
    throw new Error(`laughing-man.yaml not found in ${configDir}`);
  }

  const raw = Bun.YAML.parse(readFileSync(yamlPath, "utf8"));
  const parsed = ConfigSchema.parse(raw);

  // Load .env from config dir
  const dotEnvPath = join(configDir, ".env");
  let dotEnvVars: Record<string, string> = {};
  if (existsSync(dotEnvPath)) {
    dotEnvVars = parseDotEnv(readFileSync(dotEnvPath, "utf8"));
  }

  // Priority: process.env > .env file > config yaml
  const resend_api_key =
    process.env.RESEND_API_KEY ??
    dotEnvVars.RESEND_API_KEY ??
    parsed.env.resend_api_key;

  const resend_audience_id =
    process.env.RESEND_AUDIENCE_ID ??
    dotEnvVars.RESEND_AUDIENCE_ID ??
    parsed.env.resend_audience_id;

  function resolvePath(p: string): string {
    return isAbsolute(p) ? p : resolve(configDir, p);
  }

  return {
    ...parsed,
    issues_dir: resolvePath(parsed.issues_dir),
    attachments_dir: parsed.attachments_dir ? resolvePath(parsed.attachments_dir) : undefined,
    env: { resend_api_key, resend_audience_id },
    configDir,
  };
}
