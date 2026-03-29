import { createApp } from "./app.js";
import { createDatabase } from "./db.js";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const dbFile = process.env.DB_FILE ?? "./apps/api/data/descent.db";
const port = Number(process.env.PORT ?? "8787");
const appUrl = process.env.APP_URL ?? "http://localhost:5173";
const adminToken = process.env.ADMIN_TOKEN ?? "descent-admin";
const cookieSecure = (process.env.COOKIE_SECURE ?? "false") === "true";
const production = process.env.NODE_ENV === "production";
const frontendDir = production ? process.env.WEB_DIST_DIR ?? fileURLToPath(new URL("../../web/dist/", import.meta.url)) : undefined;

const db = createDatabase(dbFile);
db.migrate();
db.seed();

if (production && frontendDir && !existsSync(frontendDir)) {
  throw new Error(`frontend bundle not found at ${frontendDir}`);
}

const app = createApp(db, {
  appUrl: production ? undefined : appUrl,
  adminToken,
  cookieName: "descent_session",
  cookieSecure,
  frontendDir
});

const start = async () => {
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
};

if (process.env.NODE_ENV !== "test") {
  void start();
}

export { app, db };
