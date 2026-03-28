import { join } from "node:path";
import { runBuild } from "./build.js";

interface PreviewOptions {
  configDir: string;
}

export async function runPreview(options: PreviewOptions): Promise<void> {
  const { configDir } = options;

  await runBuild({ configDir, includeDrafts: true });

  const websiteDir = join(configDir, "output", "website");

  const server = Bun.serve({
    port: 4000,
    fetch(req) {
      const url = new URL(req.url);
      let pathname = url.pathname;

      if (pathname.endsWith("/")) {
        pathname += "index.html";
      }

      const filePath = join(websiteDir, pathname);
      const file = Bun.file(filePath);
      return new Response(file);
    },
    error() {
      return new Response("Not found", { status: 404 });
    },
  });

  const url = `http://localhost:${server.port}/`;

  console.log(`Preview server running at ${url}`);
  console.log("Press Ctrl+C to stop.");
}
