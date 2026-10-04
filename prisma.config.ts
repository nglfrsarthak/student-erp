// Prisma 7 configuration.
// Datasource URLs live here (not in schema.prisma) so they are read from the
// environment in one place. See .env.example.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});