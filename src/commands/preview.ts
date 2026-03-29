import { watch } from "node:fs";
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
  const themesDir = resolve(import.meta.dirname, "../../themes/default");
  const encoder = new TextEncoder();

  const clients = new Set<ReadableStreamDefaultController>();
  const reloadScript = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;

  let rebuildTimer: Timer | null = null;
  let building = false;

  function scheduleRebuild() {
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
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/__reload") {
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
  console.log("Watching for changes...");
  console.log("Press Ctrl+C to stop.");
}
