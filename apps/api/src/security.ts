import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";

const PASSWORD_ITERATIONS = 120_000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha512").toString("hex");
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string | null): boolean {
  if (!encoded) {
    return false;
  }

  const [scheme, iterationString, salt, expected] = encoded.split("$");
  if (scheme !== "pbkdf2" || !iterationString || !salt || !expected) {
    return false;
  }

  const iterations = Number(iterationString);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const actual = pbkdf2Sync(password, salt, iterations, expected.length / 2, "sha512");
  return timingSafeEqual(Buffer.from(expected, "hex"), actual);
}

export function createSessionToken(): string {
  return randomBytes(24).toString("hex");
}

