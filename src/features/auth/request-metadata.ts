import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
  requestId?: string;
}

export function firstValidForwardedAddress(
  value: string | null,
): string | null {
  if (value === null) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first !== undefined && isIP(first) !== 0 ? first : null;
}

export async function getRequestMetadata(): Promise<RequestMetadata> {
  const requestHeaders = await headers();
  const ipAddress = firstValidForwardedAddress(
    requestHeaders.get("x-vercel-forwarded-for") ??
      requestHeaders.get("cf-connecting-ip") ??
      requestHeaders.get("x-forwarded-for") ??
      requestHeaders.get("x-real-ip"),
  );
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null;

  const requestId =
    requestHeaders.get("x-request-id")?.match(/^[0-9a-f-]{36}$/i)?.[0] ??
    randomUUID();
  return { ipAddress, userAgent, requestId };
}
