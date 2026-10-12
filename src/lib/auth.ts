import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import type { Role } from "@/generated/prisma/enums";

const COOKIE_NAME = "erp_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type Session = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set and at least 32 characters long. See .env.example.",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Create a signed session token for a user. */
export async function createSessionToken(session: Omit<Session, "userId"> & { userId: string }) {
  return new SignJWT({
    email: session.email,
    name: session.name,
    role: session.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export const SESSION_COOKIE = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE_SECONDS,
};

/**
 * Should this response's session cookie carry the Secure flag?
 *
 * Decide it from the scheme the request actually arrived on, not NODE_ENV. A
 * production build served over plain HTTP - the Docker stack on
 * http://<lan-ip>:3000, say - must not set Secure: browsers refuse to store a
 * Secure cookie from an insecure origin, so login appears to succeed and then
 * every page bounces to /login.
 *
 * A reverse proxy (nginx, Cloudflare tunnel, a load balancer) reports the
 * original scheme in x-forwarded-proto, which is then authoritative. Otherwise
 * fall back to the request URL itself.
 */
export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    const first = forwarded.split(",")[0] ?? "";
    return first.trim().toLowerCase() === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    // An unparseable URL cannot prove HTTPS, so do not claim it.
    return false;
  }
}

/** Read + verify the current session, or null if absent/invalid. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as Role,
    };
  } catch {
    // Expired or tampered token - treat as logged out.
    return null;
  }
}

/**
 * Require a session. Redirects to /login when there is none.
 * Use at the top of every page and mutating API route.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Require one of the given roles. Returns the session, or redirects.
 * ADMIN is always allowed - they are the fallback owner of the system.
 *
 * The redirect carries a short reason code that the dashboard turns into a
 * visible notice. It used to send a bare "/?denied=1" that nothing ever read,
 * so a permission failure looked like a dead link: the URL changed and changed
 * straight back, with no explanation.
 */
export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "ADMIN" && !roles.includes(session.role)) {
    redirect(`/?denied=${roles.includes("FACULTY") ? "staff" : "admin"}`);
  }
  return session;
}

/** For API routes: resolve a session or return a 401 response payload. */
export async function getSessionOrNull(): Promise<Session | null> {
  return getSession();
}

export { prisma };