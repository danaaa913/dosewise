import "./src/lib/env.js";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migration tracker table is stored in the auto-created "drizzle" schema
  // (Drizzle's PostgreSQL default). Pinned explicitly for clarity.
  migrations: {
    schema: "drizzle",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
