import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { existsSync, readFileSync, statSync } from "node:fs";
import path, { extname, resolve } from "node:path";
import type { PlayerProfile } from "./contracts.js";
import { z } from "zod";
import { ApiDatabase } from "./db.js";
import {
  adminLeaderboardResetSchema,
  adminLevelUpdateSchema,
  authGuestSchema,
  authLoginSchema,
  authRegisterSchema,
  authUpgradeSchema,
  defaultLevelId,
  profilePatchSchema,
  progressPutSchema,
  leaderboardQuerySchema,
  runResultSchema
} from "./contracts.js";

export type AppConfig = {
  appUrl?: string;
  adminToken: string;
  cookieName: string;
  cookieSecure: boolean;
  frontendDir?: string;
};

type CurrentUser = {
  profile: PlayerProfile;
  sessionToken: string;
};

export function createApp(db: ApiDatabase, config: AppConfig) {
  const app = Fastify({
    logger: false
  });

  app.register(cookie);
  if (config.appUrl) {
    app.register(cors, {
      origin: config.appUrl,
      credentials: true
    });
  }

  app.get("/healthz", () => ({ ok: true }));

  app.post("/api/v1/auth/guest", async (request, reply) => {
    const body = authGuestSchema.parse(request.body ?? {});
    const profile = db.createGuestProfile(body.pilotName ?? undefined);
    const sessionToken = db.createSession(profile.id);
    setSessionCookie(reply, config, sessionToken);
    return { profile };
  });

  app.post("/api/v1/auth/register", async (request, reply) => {
    const body = authRegisterSchema.parse(request.body);
    const current = getCurrentUser(request, db, config);
    const profile = current?.profile.accountType === "guest"
      ? db.upgradeGuestProfile(current.profile.id, { pilotName: body.pilotName, email: body.email, password: body.password })
      : db.createRegisteredProfile({
          pilotName: body.pilotName,
          email: body.email,
          password: body.password,
          preferredDifficulty: "normal"
        });
    if (current) {
      db.deleteSession(current.sessionToken);
    }
    const sessionToken = db.createSession(profile.id);
    setSessionCookie(reply, config, sessionToken);
    return { profile };
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = authLoginSchema.parse(request.body);
    const profile = db.authenticate(body.email, body.password);
    if (!profile) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    const sessionToken = db.createSession(profile.id);
    setSessionCookie(reply, config, sessionToken);
    return { profile };
  });

  app.post("/api/v1/auth/upgrade", async (request, reply) => {
    const current = requireCurrentUser(request, db, config, reply);
    if (!current) {
      return;
    }
    if (current.profile.accountType !== "guest") {
      return reply.code(409).send({ error: "profile is already registered" });
    }
    const body = authUpgradeSchema.parse(request.body);
    const profile = db.upgradeGuestProfile(current.profile.id, body);
    return { profile };
  });

  app.get("/api/v1/profile", async (request, reply) => {
    const current = requireCurrentUser(request, db, config, reply);
    if (!current) {
      return;
    }
    return {
      profile: current.profile,
      progress: db.listProgress(current.profile.id)
    };
  });

  app.patch("/api/v1/profile", async (request, reply) => {
    const current = requireCurrentUser(request, db, config, reply);
    if (!current) {
      return;
    }
    const body = profilePatchSchema.parse(request.body);
    const profile = db.updateProfile(current.profile.id, body);
    return { profile };
  });

  app.get("/api/v1/progress/:levelId", async (request, reply) => {
    const current = requireCurrentUser(request, db, config, reply);
    if (!current) {
      return;
    }
    const params = z.object({ levelId: z.string() }).parse(request.params);
    return {
      levelId: params.levelId,
      state: db.getProgress(current.profile.id, params.levelId)
    };
  });

  app.put("/api/v1/progress/:levelId", async (request, reply) => {
    const current = requireCurrentUser(request, db, config, reply);
    if (!current) {
      return;
    }
    const params = z.object({ levelId: z.string() }).parse(request.params);
    const body = progressPutSchema.parse(request.body);
    db.saveProgress(current.profile.id, params.levelId, body.state);
    return {
      levelId: params.levelId,
      state: body.state
    };
  });

  app.post("/api/v1/runs", async (request, reply) => {
    const current = requireCurrentUser(request, db, config, reply);
    if (!current) {
      return;
    }
    const body = runResultSchema.parse(request.body);
    if (body.profileId !== current.profile.id) {
      return reply.code(403).send({ error: "profile mismatch" });
    }
    const entry = db.submitRun(body);
    return {
      accepted: Boolean(entry),
      entry
    };
  });

  app.get("/api/v1/leaderboards/:levelId", (request) => {
    const params = z.object({ levelId: z.string() }).parse(request.params);
    const query = leaderboardQuerySchema.parse(request.query);
    return {
      levelId: params.levelId,
      entries: db.listLeaderboard(params.levelId, query.difficulty)
    };
  });

  app.get("/api/v1/admin/levels", async (request, reply) => {
    if (!requireAdmin(request, config)) {
      return reply.code(403).send({ error: "admin access required" });
    }
    return {
      levels: db.listLevels().map((level) => ({
        levelId: level.levelId,
        title: level.title,
        active: level.active,
        checkpointCount: level.levelId === defaultLevelId ? 3 : 0,
        objectiveCount: level.levelId === defaultLevelId ? 6 : 0
      }))
    };
  });

  app.put("/api/v1/admin/levels/:levelId", async (request, reply) => {
    if (!requireAdmin(request, config)) {
      return reply.code(403).send({ error: "admin access required" });
    }
    const params = z.object({ levelId: z.string() }).parse(request.params);
    const body = adminLevelUpdateSchema.parse(request.body);
    const level = db.setLevelActive(params.levelId, body.active);
    if (!level) {
      return reply.code(404).send({ error: "level not found" });
    }
    return { level };
  });

  app.post("/api/v1/admin/leaderboards/reset", async (request, reply) => {
    if (!requireAdmin(request, config)) {
      return reply.code(403).send({ error: "admin access required" });
    }
    const body = adminLeaderboardResetSchema.parse(request.body ?? {});
    const cleared = db.resetLeaderboard(body.levelId ?? defaultLevelId);
    return { cleared };
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: "validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    if (error instanceof Error && (error.message.includes("email already in use") || isUniqueConstraintError(error))) {
      return reply.code(409).send({ error: error.message.includes("email already in use") ? error.message : "duplicate record" });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "internal server error" });
  });

  if (config.frontendDir) {
    const frontendRoot = resolve(config.frontendDir);

    app.setNotFoundHandler((request, reply) => {
      const pathname = new URL(request.raw.url ?? "/", "http://localhost").pathname;

      if (pathname.startsWith("/api/")) {
        return reply.code(404).send({ error: "not found" });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return reply.code(404).send({ error: "not found" });
      }

      const assetPath = resolveAssetPath(frontendRoot, pathname);
      if (assetPath) {
        return sendFile(reply, assetPath);
      }

      const indexPath = path.join(frontendRoot, "index.html");
      if (!existsSync(indexPath)) {
        return reply.code(500).send({ error: "frontend bundle missing" });
      }

      return sendFile(reply, indexPath);
    });
  }

  return app;
}

function getCurrentUser(request: FastifyRequest, db: ApiDatabase, config: AppConfig): CurrentUser | null {
  const token = request.cookies[config.cookieName];
  if (!token) {
    return null;
  }

  const session = db.getSession(token);
  if (!session) {
    return null;
  }

  return {
    profile: session.profile,
    sessionToken: token
  };
}

function requireCurrentUser(request: FastifyRequest, db: ApiDatabase, config: AppConfig, reply: FastifyReply): CurrentUser | null {
  const current = getCurrentUser(request, db, config);
  if (!current) {
    reply.code(401).send({ error: "authentication required" });
    return null;
  }
  return current;
}

function requireAdmin(request: FastifyRequest, config: AppConfig): boolean {
  const token = request.headers["x-admin-token"];
  if (typeof token !== "string") {
    return false;
  }
  return token === config.adminToken;
}

function setSessionCookie(reply: FastifyReply, config: AppConfig, token: string): void {
  reply.setCookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/",
    maxAge: 30 * 24 * 60 * 60
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
}

function resolveAssetPath(frontendRoot: string, pathname: string): string | null {
  if (pathname === "/") {
    return null;
  }

  if (extname(pathname) === "") {
    return null;
  }

  const candidate = resolve(frontendRoot, `.${pathname}`);
  const rootPrefix = frontendRoot.endsWith(path.sep) ? frontendRoot : `${frontendRoot}${path.sep}`;
  if (!candidate.startsWith(rootPrefix)) {
    return null;
  }

  if (!existsSync(candidate)) {
    return null;
  }

  if (!statSync(candidate).isFile()) {
    return null;
  }

  return candidate;
}

function sendFile(reply: FastifyReply, filePath: string) {
  reply.type(getContentType(filePath));
  if (reply.request.method === "HEAD") {
    return reply.send();
  }
  return reply.send(readFileSync(filePath));
}

function getContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
