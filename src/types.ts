export interface FrontmatterRaw {
  issue: number;
  status: "draft" | "ready";
  title?: string;
  date?: string;
}

export interface IssueData {
  issue: number;
  status: "draft" | "ready";
  title: string;       // Extracted from first # heading in body
  date?: string;       // YYYY-MM-DD, required when status is "ready"
  filePath: string;    // Absolute path to source .md file
  rawContent: string;  // Markdown body (frontmatter stripped)
  html: string;        // Rendered HTML from markdown (before image rewriting)
}

export interface SiteConfig {
  name: string;
  description?: string;
  url: string;
  issues_dir: string;           // Resolved absolute path
  attachments_dir?: string;     // Resolved absolute path (optional)
  web_hosting: {
    provider: "cloudflare-pages";
    project: string;               // Cloudflare Pages project name
    domain?: string;               // Custom domain (optional)
  };
  email_hosting: {
    from: string;
    reply_to?: string;
    provider: "resend";
  };
  env: {
    cloudflare_api_token?: string;
    cloudflare_account_id?: string;
    resend_api_key?: string;
  };
  // Internal: resolved at load time
  configDir: string;            // Directory containing laughing-man.yaml
}

export interface IssueProps {
  title: string;
  issue: number;
  content: string;    // Rendered HTML (image src already rewritten)
  config: SiteConfig;
}
