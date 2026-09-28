import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../..", import.meta.url));
const appearance = readFileSync(`${root}/static/js/themetoggle.js`, "utf8");
export default defineConfig(({ command }) => ({
  base: "/images/",
  server: { fs: { allow: [root] } },
  plugins: [
    react(),
    {
      name: "images-site-appearance",
      configureServer(server) {
        server.middlewares.use("/images/appearance.js", (_req, res) => {
          res.setHeader("Content-Type", "application/javascript");
          res.end(appearance);
        });
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "appearance.js",
          source: appearance,
        });
      },
      transformIndexHtml: {
        order: "post",
        handler() {
          const security =
            command === "build"
              ? [
                  {
                    tag: "meta",
                    attrs: {
                      "http-equiv": "Content-Security-Policy",
                      content:
                        "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: blob: data:; connect-src https://api.github.com; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
                    },
                    injectTo: "head-prepend",
                  },
                ]
              : [];
          return [
            ...security,
            {
              tag: "script",
              attrs: { src: "/images/appearance.js" },
              injectTo: "head" as const,
            },
          ];
        },
      },
    },
  ],
}));
