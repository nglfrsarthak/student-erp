import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession, type Session } from "./auth";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, ...(details ? { details } : {}) },
    { status },
  );
}

export const unauthorized = () => fail("Authentication required", 401);
export const forbidden = () => fail("You do not have permission to do that", 403);
export const notFound = (what = "Resource") => fail(`${what} not found`, 404);

/** Turn a ZodError into a 422 with per-field messages. */
export function fromZodError(err: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return NextResponse.json(
    { ok: false, error: "Validation failed", fields },
    { status: 422 },
  );
}

/**
 * Resolve the session for a route handler.
 * Returns either the session or a ready-to-return 401 response.
 */
export async function authenticateRequest(): Promise<
  { session: Session; response?: never } | { session?: never; response: NextResponse }
> {
  const session = await getSession();
  if (!session) return { response: unauthorized() };
  return { session };
}

/** Only ADMIN (or the listed roles) may perform a write. */
export function canWrite(session: Session, roles: string[] = ["ADMIN", "FACULTY"]) {
  return roles.includes(session.role);
}

/** Wrap a handler so unexpected errors become 500s instead of crashing. */
export async function handle(fn: () => Promise<NextResponse>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    console.error("[api] unhandled error:", err);
    return fail(
      err instanceof Error ? err.message : "Unexpected server error",
      500,
    );
  }
}