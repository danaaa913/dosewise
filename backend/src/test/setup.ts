import "../lib/env.js";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

if (!process.env.API_RATE_LIMIT) {
  process.env.API_RATE_LIMIT = "100000";
}
