import { watch, existsSync, readFileSync, readdirSync, createReadStream, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { createServer } from "node:http";
import { runBuild } from "./build.js";
import { handleSubscribe } from "../../functions/api/subscribe.js";

interface PreviewOptions {
  configDir: string;
  includeDrafts: boolean;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function runPreview(options: PreviewOptions): Promise<void> {
  const { configDir, includeDrafts } = options;

  const { config } = await runBuild({ configDir, includeDrafts });
  const websiteDir = resolve(configDir, "output", "website");
  const emailDir = resolve(configDir, "output", "email");
  const themesDir = resolve(import.meta.dirname, "../../themes/default");

  const clients = new Set<{ write: (data: string) => void; end: () => void }>();
  const reloadScript = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;

  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let building = false;
  let cooldown = false;

  function scheduleRebuild() {
    if (building || cooldown) return;
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      if (building) return;
      building = true;
      try {
        await runBuild({ configDir, includeDrafts });
        for (const client of clients) {
          try {
            client.write("data: reload\n\n");
          } catch {
            clients.delete(client);
          }
        }
      } catch (err) {
        console.error("Rebuild failed:", err);
      }
      building = false;
      cooldown = true;
      setTimeout(() => { cooldown = false; }, 500);
    }, 300);
  }

  function shouldIgnore(filename: string | null) {
    if (!filename) return true;
    const parts = filename.split(/[/\\]/);
    return parts.includes("output") || parts.includes("node_modules") || parts.includes(".git");
  }

  watch(config.issues_dir, { recursive: true }, (_event, filename) => {
    if (!shouldIgnore(filename)) scheduleRebuild();
  });
  watch(themesDir, { recursive: true }, () => scheduleRebuild());
  watch(join(configDir, "laughing-man.yaml"), () => scheduleRebuild());

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost:4000"}`);

    try {
      // SSE endpoint for live reload
      if (url.pathname === "/__reload") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });
        const client = {
          write: (data: string) => res.write(data),
          end: () => res.end(),
        };
        clients.add(client);
        req.on("close", () => clients.delete(client));
        return;
      }

      // Subscribe API
      if (url.pathname === "/api/subscribe") {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json", "Allow": "POST" });
          res.end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }

        if (!config.env.RESEND_API_KEY) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "RESEND_API_KEY is not configured for preview." }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const response = await handleSubscribe(body as { email?: string } | null, {
            RESEND_API_KEY: config.env.RESEND_API_KEY,
          });
          const responseBody = await response.text();
          res.writeHead(response.status, { "Content-Type": "application/json" });
          res.end(responseBody);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid request." }));
        }
        return;
      }

      // Email preview: index page listing all email issues
      if (url.pathname === "/email/" || url.pathname === "/email") {
        const emailFiles = existsSync(emailDir)
          ? readdirSync(emailDir)
              .filter((f) => f.endsWith(".html"))
              .sort((a, b) => {
                const numA = parseInt(a.replace(".html", ""), 10);
                const numB = parseInt(b.replace(".html", ""), 10);
                return numA - numB;
              })
          : [];

        const links = emailFiles
          .map((f) => {
            const num = f.replace(".html", "");
            return `<li><a href="/email/${f}">Issue #${num}</a></li>`;
          })
          .join("\n");

        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Email Preview</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:40px auto;padding:0 20px}
a{color:#005577}li{margin:8px 0}</style></head>
<body><h1>Email Preview</h1>
<p><a href="/">&larr; Back to website preview</a></p>
<ul>${links}</ul>
${reloadScript}
</body></html>`;

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(indexHtml);
        return;
      }

      // Email preview: individual email HTML files
      if (url.pathname.startsWith("/email/") && url.pathname.endsWith(".html")) {
        const emailFilePath = resolve(join(emailDir, url.pathname.replace("/email/", "")));
        if (!emailFilePath.startsWith(emailDir)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }
        if (existsSync(emailFilePath)) {
          const html = readFileSync(emailFilePath, "utf8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html.replace("</body>", `${reloadScript}</body>`));
          return;
        }
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      // Static file serving for website preview
      let pathname = url.pathname;
      if (pathname.endsWith("/")) pathname += "index.html";

      const filePath = resolve(join(websiteDir, pathname));
      if (!filePath.startsWith(websiteDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      if (filePath.endsWith(".html")) {
        const html = readFileSync(filePath, "utf8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html.replace("</body>", `${reloadScript}</body>`));
        return;
      }

      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      const stat = statSync(filePath);
      res.writeHead(200, { "Content-Type": contentType, "Content-Length": stat.size });
      createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(4000, () => {
    console.log("Preview server running at http://localhost:4000/");
    console.log("Email preview at http://localhost:4000/email/");
    console.log("Watching for changes...");
    console.log("Press Ctrl+C to stop.");
  });
}
