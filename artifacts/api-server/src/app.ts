import path from "node:path";
import fs from "node:fs";
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

// Serve the Vite frontend from the same process (single Render Web Service).
const publicDir = path.resolve(
  process.cwd(),
  "artifacts/amazonscope/dist/public",
);

if (fs.existsSync(publicDir)) {
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
    { publicDir },
    "Frontend build not found — API only. Run the frontend build first for combined deploy.",
  );
}

export default app;
