#!/usr/bin/env node
/**
 * Creates (or recreates) the Prisma shadow database.
 *
 * `prisma migrate dev` and `prisma migrate diff --from-migrations` need to
 * replay the migration history somewhere disposable. Left to itself Prisma
 * creates and drops a throwaway database, which needs CREATE DATABASE rights
 * and leaves the outcome up to the server. CI prefers a database it controls,
 * so it points SHADOW_DATABASE_URL at a real one and runs this first.
 *
 * Usage:
 *   $env:SHADOW_DATABASE_URL = "postgresql://erp:erp_secret@localhost:5432/student_erp_shadow"
 *   node scripts/create-shadow-db.mjs
 */

import pg from "pg";

const SHADOW_URL = process.env.SHADOW_DATABASE_URL;

if (!SHADOW_URL) {
  console.error(
    "Missing SHADOW_DATABASE_URL. Example:\n" +
      '  $env:SHADOW_DATABASE_URL = "postgresql://erp:erp_secret@localhost:5432/student_erp_shadow"',
  );
  process.exit(1);
}

const { Client } = pg;

const target = new URL(SHADOW_URL);
const dbName = decodeURIComponent(target.pathname.replace(/^\//, ""));

if (!dbName) {
  console.error(`SHADOW_DATABASE_URL has no database name: ${SHADOW_URL}`);
  process.exit(1);
}

// Identifiers cannot be parameterised, so make sure the name is a plain,
// unquoted Postgres identifier before it reaches DDL.
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) {
  console.error(
    `Shadow database name must be a simple identifier, got: ${JSON.stringify(dbName)}`,
  );
  process.exit(1);
}

// CREATE/DROP DATABASE cannot run inside the target database, so connect to
// the always-present `postgres` maintenance database on the same server.
const admin = new Client({
  host: target.hostname,
  port: target.port || "5432",
  user: decodeURIComponent(target.username),
  password: decodeURIComponent(target.password),
  database: "postgres",
  ssl: target.searchParams.get("sslmode") === "require" ? { rejectUnauthorized: false } : undefined,
});

try {
  await admin.connect();
  // Recreate rather than reuse: a shadow database must start empty, and a
  // half-populated one produces confusing drift reports.
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  console.log(`Shadow database "${dbName}" is ready.`);
} catch (err) {
  console.error(`Failed to create shadow database "${dbName}": ${err.message}`);
  console.error(
    "The configured role needs CREATEDB rights to do this. In docker compose the\n" +
      "`erp` role is the Postgres superuser, so this should already work there.",
  );
  process.exitCode = 1;
} finally {
  await admin.end().catch(() => {});
}