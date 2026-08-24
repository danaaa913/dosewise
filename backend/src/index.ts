import "./lib/env.js";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { ensureDefaultAdmin } from "./lib/seed-admin.js";

const port = Number(process.env["PORT"] ?? "8080");

async function start() {
  await ensureDefaultAdmin();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
