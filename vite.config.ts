// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function ensureServerJsCompatibilityPlugin(): Plugin {
  return {
    name: "read-flow-state:ensure-server-js-compatibility",
    apply: "build",
    closeBundle() {
      const distServerDir = resolve(process.cwd(), "dist", "server");
      const expectedServerEntry = join(distServerDir, "server.js");

      if (!existsSync(distServerDir) || existsSync(expectedServerEntry)) {
        return;
      }

      const candidates = ["server.mjs", "index.mjs", "index.js", "server.cjs"]
        .map((fileName) => join(distServerDir, fileName))
        .filter(existsSync);

      if (candidates.length === 0) {
        const availableFiles = readdirSync(distServerDir);
        throw new Error(
          `TanStack prerender expects dist/server/server.js, but no compatible server entry was found in dist/server. Found: ${availableFiles.join(", ") || "(empty directory)"}`,
        );
      }

      const target = candidates[0];
      const targetFileName = basename(target);
      const targetExtension = extname(targetFileName);
      const importBinding = targetExtension === ".cjs" ? "serverModule" : "server";
      const wrapperSource =
        targetExtension === ".cjs"
          ? `import serverModule from "./${targetFileName}";\nexport default serverModule.default ?? serverModule;\n`
          : `import server from "./${targetFileName}";\nexport default server;\n`;

      writeFileSync(expectedServerEntry, wrapperSource, "utf8");
      console.log(
        `[read-flow-state] Created dist/server/server.js compatibility wrapper for ${targetFileName}.`,
      );
    },
  };
}

export default defineConfig({
  vite: {
    base: process.env.NODE_ENV === "production" ? "/read-flow-state/" : "/",
    plugins: [ensureServerJsCompatibilityPlugin()],
  },
  tanstackStart: {
    spa: {
      enabled: true,
    },
    // Keep the server entry explicit so Vite/TanStack resolve the same file on
    // Windows locally and Linux in GitHub Actions during prerender.
    server: { entry: "./src/server.ts" },
  },
});
