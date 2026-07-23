import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AuthorizationError,
  hasAnyPermission,
  hasLocationAccess,
  hasPermission,
  hasRole,
} from "@/features/auth/authorization";
import type { PermissionKey } from "@/features/auth/permissions";
import { hashSessionToken } from "@/features/auth/session-token";
import type { Prisma } from "@/generated/prisma/client";
import { UserStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";

const DEVELOPMENT_COOKIE_NAME = "pos_session";
const PRODUCTION_COOKIE_NAME = "__Host-pos_session";

export interface AuthLocation {
  id: string;
  code: string;
  name: string;
}

export interface AuthRole {
  code: string;
  name: string;
}

export interface AuthContext {
  sessionId: string;
  expiresAt: Date;
  rememberMe: boolean;
  user: {
    id: string;
    businessId: string;
    email: string;
    username: string;
    displayName: string;
  };
  business: {
    id: string;
    slug: string;
    name: string;
    currencyCode: string;
    timezone: string;
    locale: string;
  };
  roles: readonly AuthRole[];
  roleCodes: readonly string[];
  permissions: ReadonlySet<string>;
  locations: readonly AuthLocation[];
  currentLocation: AuthLocation | null;
}

export { AuthorizationError } from "@/features/auth/authorization";

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME;
}

export {
  createRawSessionToken,
  hashSessionToken,
} from "@/features/auth/session-token";

export async function createSessionRecord(
  transaction: Prisma.TransactionClient,
  input: Readonly<{
    businessId: string;
    userId: string;
    currentLocationId: string | null;
    tokenHash: string;
    rememberMe: boolean;
    ipAddress: string | null;
    userAgent: string | null;
  }>,
): Promise<{ id: string; expiresAt: Date }> {
  const { AUTH_SESSION_TTL_HOURS, AUTH_REMEMBER_ME_TTL_DAYS } =
    getServerEnvironment();
  const lifetimeMilliseconds = input.rememberMe
    ? AUTH_REMEMBER_ME_TTL_DAYS * 24 * 60 * 60 * 1000
    : AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + lifetimeMilliseconds);

  return transaction.session.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      currentLocationId: input.currentLocationId,
      tokenHash: input.tokenHash,
      rememberMe: input.rememberMe,
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
    select: { id: true, expiresAt: true },
  });
}

export async function setSessionCookie(
  rawToken: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}

export async function getCurrentRawSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(getSessionCookieName())?.value ?? null;
}

export async function resolveSessionToken(
  rawToken: string,
  now = new Date(),
): Promise<AuthContext | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(rawToken) },
    select: {
      id: true,
      businessId: true,
      currentLocationId: true,
      rememberMe: true,
      expiresAt: true,
      lastSeenAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          businessId: true,
          email: true,
          username: true,
          displayName: true,
          status: true,
          archivedAt: true,
          business: {
            select: {
              id: true,
              slug: true,
              name: true,
              currencyCode: true,
              timezone: true,
              locale: true,
              archivedAt: true,
            },
          },
          roles: {
            where: { role: { archivedAt: null } },
            select: {
              role: {
                select: {
                  code: true,
                  name: true,
                  permissions: {
                    select: { permission: { select: { key: true } } },
                  },
                },
              },
            },
          },
          locations: {
            where: {
              location: { isActive: true, archivedAt: null },
            },
            select: {
              location: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (
    session === null ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    session.businessId !== session.user.businessId ||
    session.user.status !== UserStatus.ACTIVE ||
    session.user.archivedAt !== null ||
    session.user.business.archivedAt !== null
  ) {
    return null;
  }

  const roles = session.user.roles.map(({ role }) => ({
    code: role.code,
    name: role.name,
  }));
  const roleCodes = roles.map(({ code }) => code);
  const permissions = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  const locations = session.user.locations.map(({ location }) => location);
  const currentLocation =
    locations.find(({ id }) => id === session.currentLocationId) ??
    locations[0] ??
    null;

  if (now.getTime() - session.lastSeenAt.getTime() >= 5 * 60 * 1000) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  }

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    rememberMe: session.rememberMe,
    user: {
      id: session.user.id,
      businessId: session.user.businessId,
      email: session.user.email,
      username: session.user.username,
      displayName: session.user.displayName,
    },
    business: {
      id: session.user.business.id,
      slug: session.user.business.slug,
      name: session.user.business.name,
      currencyCode: session.user.business.currencyCode,
      timezone: session.user.business.timezone,
      locale: session.user.business.locale,
    },
    roles,
    roleCodes,
    permissions,
    locations,
    currentLocation,
  };
}

export const getCurrentUser = cache(async (): Promise<AuthContext | null> => {
  const rawToken = await getCurrentRawSessionToken();
  return rawToken === null ? null : resolveSessionToken(rawToken);
});

export const getAuthContext = getCurrentUser;

export async function requireUser(): Promise<AuthContext> {
  const context = await getCurrentUser();
  if (context === null) {
    redirect("/login");
  }
  return context;
}

export const requireAuth = requireUser;

export async function requirePermission(
  permission: PermissionKey,
): Promise<AuthContext> {
  const context = await requireUser();
  if (!hasPermission(context, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
  return context;
}

export async function requireAnyPermission(
  permissions: readonly PermissionKey[],
): Promise<AuthContext> {
  if (permissions.length === 0) {
    throw new RangeError("At least one permission is required");
  }
  const context = await requireUser();
  if (!hasAnyPermission(context, permissions)) {
    throw new AuthorizationError(
      `Missing one of the required permissions: ${permissions.join(", ")}`,
    );
  }
  return context;
}

export async function requireRole(roleCode: string): Promise<AuthContext> {
  const context = await requireUser();
  if (!hasRole(context, roleCode)) {
    throw new AuthorizationError(`Missing role: ${roleCode}`);
  }
  return context;
}

export async function requireLocationAccess(
  locationId: string,
): Promise<AuthContext> {
  const context = await requireUser();
  if (!hasLocationAccess(context, locationId)) {
    throw new AuthorizationError(
      "You do not have access to this location",
      "LOCATION_FORBIDDEN",
    );
  }
  return context;
}
