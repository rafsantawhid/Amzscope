import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

/**
 * Resolve the Vite frontend build directory.
 * Works whether the process starts from the monorepo root or from
 * artifacts/api-server (pnpm --filter sets cwd to the package).
 */
function resolvePublicDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Preferred: frontend copied next to the API bundle during build:render
    path.resolve(here, "public"),
    path.resolve(here, "../public"),
    // Monorepo root as cwd
    path.resolve(process.cwd(), "artifacts/amazonscope/dist/public"),
    // api-server package as cwd
    path.resolve(process.cwd(), "../amazonscope/dist/public"),
    path.resolve(process.cwd(), "dist/public"),
    // Fallbacks from this file's location (src or dist)
    path.resolve(here, "../../amazonscope/dist/public"),
    path.resolve(here, "../../../amazonscope/dist/public"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

const publicDir = resolvePublicDir();

if (publicDir) {
  app.use(express.static(publicDir, { index: false, maxAge: "1h" }));

  // SPA fallback: non-API GET routes get index.html so client routing works.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });

  logger.info({ publicDir }, "Serving frontend static assets");
} else {
  logger.warn(
    {
      cwd: process.cwd(),
      tried: [
        "dist/public (next to API)",
        "artifacts/amazonscope/dist/public",
        "../amazonscope/dist/public",
      ],
    },
    "Frontend build not found — API only. Run: pnpm run build:render",
  );
}

export default app;
