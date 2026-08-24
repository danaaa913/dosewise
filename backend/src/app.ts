import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { noCache } from "./middlewares/no-cache.js";
import { allowedOrigins, isOriginAllowed, apiLimiter } from "./lib/rate-limit.js";

export const SESSION_COOKIE_NAME = "dosewise.sid";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error(
    "SESSION_SECRET is missing. Add it to your .env file — refusing to start with an insecure default.",
  );
}

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
  }),
);

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !isOriginAllowed(req.headers.origin)) {
    res.status(403).json({ error: "Cross-origin request rejected" });
    return;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", apiLimiter, noCache, router);

if (process.env.NODE_ENV === "production") {
  const here = dirname(fileURLToPath(import.meta.url));
  const frontendDist = [resolve(here, "../../frontend/dist"), resolve(here, "../../../frontend/dist")]
    .find((candidate) => existsSync(join(candidate, "index.html")));

  if (frontendDist) {
    logger.info({ frontendDist }, "Serving frontend static files");
    app.use(express.static(frontendDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(join(frontendDist, "index.html"));
    });
  } else {
    logger.warn("NODE_ENV is production but frontend/dist was not found — API only.");
  }
}

export default app;
