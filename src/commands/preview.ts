import { watch, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../pipeline/config.js";
import { runBuild } from "./build.js";

interface PreviewOptions {
  configDir: string;
  includeDrafts: boolean;
}

export async function runPreview(options: PreviewOptions): Promise<void> {
  const { configDir, includeDrafts } = options;

  await runBuild({ configDir, includeDrafts });

  const config = await loadConfig(configDir);
  const websiteDir = resolve(configDir, "output", "website");
  const emailDir = resolve(configDir, "output", "email");
  const themesDir = resolve(import.meta.dirname, "../../themes/default");
  const encoder = new TextEncoder();

  const clients = new Set<ReadableStreamDefaultController>();
  const reloadScript = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;

  let rebuildTimer: Timer | null = null;
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
            client.enqueue(encoder.encode("data: reload\n\n"));
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

  const server = Bun.serve({
    port: 4000,
    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/__reload") {
        server.timeout(req, 0);
        let ctrl: ReadableStreamDefaultController | undefined;
        const stream = new ReadableStream({
          start(controller) {
            ctrl = controller;
            clients.add(controller);
          },
          cancel() {
            if (ctrl) clients.delete(ctrl);
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Email preview: index page listing all email issues
      if (url.pathname === "/email/" || url.pathname === "/email") {
        const emailFiles = existsSync(emailDir)
          ? (await Array.fromAsync(new Bun.Glob("*.html").scan(emailDir)))
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

        return new Response(indexHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Email preview: individual email HTML files
      if (url.pathname.startsWith("/email/") && url.pathname.endsWith(".html")) {
        const emailFilePath = resolve(join(emailDir, url.pathname.replace("/email/", "")));
        if (!emailFilePath.startsWith(emailDir)) {
          return new Response("Forbidden", { status: 403 });
        }
        const emailFile = Bun.file(emailFilePath);
        if (await emailFile.exists()) {
          const html = await emailFile.text();
          return new Response(
            html.replace("</body>", `${reloadScript}</body>`),
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      }

      let pathname = url.pathname;
      if (pathname.endsWith("/")) pathname += "index.html";

      const filePath = resolve(join(websiteDir, pathname));
      if (!filePath.startsWith(websiteDir)) {
        return new Response("Forbidden", { status: 403 });
      }

      const file = Bun.file(filePath);

      if (filePath.endsWith(".html")) {
        const html = await file.text();
        return new Response(
          html.replace("</body>", `${reloadScript}</body>`),
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }

      return new Response(file);
    },
    error() {
      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Preview server running at http://localhost:${server.port}/`);
  console.log(`Email preview at http://localhost:${server.port}/email/`);
  console.log("Watching for changes...");
  console.log("Press Ctrl+C to stop.");
}
