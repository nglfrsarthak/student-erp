import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and set it.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * The real client, created on first use.
 *
 * The instance is cached on globalThis so dev hot reloads reuse one connection
 * pool instead of opening a new one on every save.
 */
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazily-initialised Prisma client, so that merely *importing* this module is
 * safe.
 *
 * `next build` imports every page module while collecting page data, and pages
 * are force-dynamic, so they never actually query during a build. Building the
 * client at module scope meant the missing-DATABASE_URL check fired during
 * `next build` and broke Docker builds, which have no DATABASE_URL at build
 * time. Deferring construction means the check still fires on the first real
 * query, where the message is actually useful.
 *
 * A Proxy keeps the `prisma.<model>.<operation>()` call sites working unchanged.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    // Let Node/console inspect the stub rather than spinning up a client.
    if (typeof prop === "symbol") return undefined;

    const client = getPrisma();
    const value = Reflect.get(client as object, prop) as unknown;

    // Prisma's methods are bound to the client, but bind defensively so that
    // passing `prisma.student.findMany` as a callback cannot lose `this`.
    return typeof value === "function" ? value.bind(client) : value;
  },
});