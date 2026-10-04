// Prisma 7 configuration.
// Datasource URLs live here (not in schema.prisma) so they are read from the
// environment in one place. See .env.example.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasource: { url: string; shadowDatabaseUrl?: string } = {
  // Deliberately NOT `env("DATABASE_URL")`: the `env()` helper throws while
  // the config file is being loaded, which breaks every Prisma CLI command --
  // including ones that never touch the database, such as `prisma generate`
  // and `prisma format`. Commands that genuinely need a connection still
  // fail with a clear connection error when this is empty.
  url: process.env.DATABASE_URL ?? "",
};

// Optional. Only needed by commands that replay migrations into a shadow
// database (`prisma migrate dev`, `prisma migrate diff --from-migrations`).
// Left unset, Prisma creates and drops a throwaway database itself, which
// requires CREATE DATABASE rights; CI pins an explicit one instead.
//
// The key must be *absent* rather than empty: Prisma validates any value it is
// given and rejects an empty string with P1013, which broke `migrate deploy`
// in the Docker image where SHADOW_DATABASE_URL is never set.
if (process.env.SHADOW_DATABASE_URL) {
  datasource.shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource,
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});