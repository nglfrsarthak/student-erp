# syntax=docker/dockerfile:1
# ---------- base ----------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---------- build ----------
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client is generated as plain TS into src/generated/prisma, and the
# generated dir must exist before `next build` type-checks.
RUN npx prisma generate && npm run build

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# The Prisma CLI and tsx are needed at runtime: the web container runs
# `prisma migrate deploy` and `npm run db:seed` before starting. Both are
# devDependencies, and npm omits devDependencies whenever NODE_ENV is
# production -- which this stage sets -- so ask for them explicitly.
# Without this, `npx prisma` would quietly download the newest Prisma (8.x RC)
# at container start instead of using the pinned 7.10.0.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --include=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/tsconfig.json ./

EXPOSE 3000
CMD ["npm", "start"]