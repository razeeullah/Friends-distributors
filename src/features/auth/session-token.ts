import { createHash, randomBytes } from "node:crypto";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createRawSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
