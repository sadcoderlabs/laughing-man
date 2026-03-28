export interface FrontmatterRaw {
  issue: number;
  status: "draft" | "ready";
}

export interface IssueData {
  issue: number;
  status: "draft" | "ready";
  title: string;       // Extracted from first # heading in body
  filePath: string;    // Absolute path to source .md file
  rawContent: string;  // Markdown body (frontmatter stripped)
  html: string;        // Rendered HTML from markdown (before image rewriting)
}

export interface SiteConfig {
  name: string;
  url: string;
  issues_dir: string;           // Resolved absolute path
  attachments_dir?: string;     // Resolved absolute path (optional)
  web_hosting: {
    provider: "cloudflare-pages";
    project: string;               // Cloudflare Pages project name
  };
  email_hosting: {
    from: string;
    reply_to?: string;
    provider: "resend";
  };
  env: {
    resend_api_key?: string;
    resend_audience_id?: string;
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
