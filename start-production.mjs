import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

process.env.NODE_ENV = process.env.NODE_ENV ?? "production";
process.env.PORT = process.env.PORT ?? "3000";
process.env.DB_FILE = process.env.DB_FILE ?? path.join(rootDir, "apps/api/data/descent.db");
process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "descent-admin";
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE ?? "true";

const { app, db } = await import("./apps/api/dist/index.js");

console.log(`[production] integrated app listening on http://0.0.0.0:${process.env.PORT}`);

const shutdown = async (signal) => {
  console.log(`[production] received ${signal}, shutting down`);
  await app.close();
  db.close();
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
