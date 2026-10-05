# Student ERP

A campus management system covering **students, courses, enrollment, grades/CGPA**
and a live **dashboard** — Next.js 16 + PostgreSQL 17 + Prisma 7, containerised
with Docker, verified on every push by GitHub Actions, tracked in Jira.

> **Repo** `github.com/nglfrsarthak/student-erp` · **Jira** `jiraerp.atlassian.net`
> (project `SCRUM`) · **Run it** `docker compose up --build` → <http://localhost:3000>

---

## The team

| | Role | Owns |
| --- | --- | --- |
| **Sarthak Pagare** | Team lead — backend & data | Prisma schema (6 models), grading engine, 10 REST endpoints, auth & role guards |
| **Sahil** | Frontend | 13 App Router pages, Tailwind UI, student/course forms, dashboard, mark-sheet grid |
| **Sayali** | DevOps & QA | Docker image + Compose stack, GitHub Actions pipeline, Jira board, release verification |

The initial implementation was produced with AI coding assistance; between us we
own, review and maintain every area above.

---

## What it does

| Module | Highlights |
| --- | --- |
| **Dashboard** | Live counts, students-per-programme, pass rate, backlog count, top performers, CGPA distribution |
| **Students** | Full CRUD, search across name / enrollment no / email, filters for programme, semester and status, per-student transcript |
| **Courses** | Catalogue with credits, semester and owning department; class average and enrolled count |
| **Enrollments** | Programme-aware course picker, drop / reopen, term filters |
| **Grades** | Mark-sheet grid (internal /40 + final /60), live grade preview, bulk save in one transaction, automatic CGPA recalculation |

---

## Tech stack

| Layer | Choice | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, React Server Components) | 16.3.8 |
| UI | React + Tailwind CSS | 19.3.0 · 4.3.3 |
| Language | TypeScript (strict) | 5.9.3 |
| ORM | Prisma | 7.10.0 |
| Database | PostgreSQL | 17 (Alpine) |
| Auth | `jose` HS256 JWT in an httpOnly cookie + `bcryptjs` | 6.2.12 · 3.0.3 |
| Validation | Zod | 4.6.5 |
| Containers | Docker + Docker Compose | — |
| CI/CD | GitHub Actions | — |
| Planning | Jira (REST API) | — |

---

## Architecture

```
        ┌──────────────────────── browser ────────────────────────┐
        │   13 pages  +  fetch() calls, carries erp_session cookie │
        └───────────────────────────┬──────────────────────────────┘
                                    │ HTTP
        ┌───────────────────────────▼──────────────────────────────┐
        │  Next.js 16 — one container, two route groups          │
        │                                                          │
        │   app/(app)/…   server-rendered pages (force-dynamic)   │
        │   app/api/…     10 REST handlers, same JSON contract     │
        │   app/login/    sign-in                                 │
        │                                                          │
        │   lib/auth.ts     verify JWT → Session, requireRole()    │
        │   lib/grading.ts  grade scale + GPA  ◄── single truth   │
        │   lib/validation.ts  zod schemas per endpoint           │
        │   lib/prisma.ts   lazy client via @prisma/adapter-pg    │
        └───────────────────────────┬──────────────────────────────┘
                                    │ SQL (parameterised)
        ┌───────────────────────────▼──────────────────────────────┐
        │  PostgreSQL 17 — 6 models, 3 enums, FK constraints on   │
        └──────────────────────────────────────────────────────────┘
```

**Compose brings both up with one command.** `web` waits for `db` to report
healthy, applies migrations, seeds demo data, then starts serving — so there is
no separate setup step.

```
docker compose up --build
   db   postgres:17-alpine · pg_isready healthcheck · named volume erp-pgdata
   web   multi-stage build → node:22-alpine → migrate deploy → seed → next start
```

### How the site actually works

Every page is `force-dynamic`, so nothing is cached at build time — all data is
read live from Postgres on each request.

1. **Sign in** — `POST /api/auth/login` checks a bcrypt hash and sets
   `erp_session`, an HS256 JWT in an httpOnly, `SameSite=Lax` cookie.
2. **Authorise** — every page and every mutating route calls `requireSession()`
   or `requireRole()`. There are three roles: `ADMIN`, `FACULTY`, `STUDENT`.
3. **Validate** — the request body goes through a zod schema before touching the
   database.
4. **Query** — Prisma issues parameterised SQL through the `pg` driver adapter.
5. **Recalculate** — if the write touched marks, credits or an enrollment
   status, every affected student's CGPA is recomputed before the response is
   returned.
6. **Respond** — success is `{ ok: true, data }`, failure is
   `{ ok: false, error, fields }`.

Successful responses use `200`/`201`; failures use `400` bad JSON · `401` no
session · `403` wrong role · `404` missing · `409` conflict · `422` validation.

### Data model

```
Department ─┬─< Program ─┬─< Course
            │            │      ▲
            └─< Course ──┘      │
                             │
Student >── program ─────────┤
   │                          │
   └──< Enrollment >──────────┘
        (studentId, courseId, semester) is UNIQUE
```

`User` is an optional portal login linked from `Student`. Deletes are
`Restrict` on academic structure and `Cascade` on enrollments, so a student with
history cannot be deleted by accident — the API returns `409` instead.

### Grading

Marks are **internal /40 + final /60**. The server derives the percentage,
letter grade and grade points — the client never sends them.

| % | Grade | Points | | % | Grade | Points |
|---|---|---|---|---|---|---|
| 90–100 | A+ | 4.0 | | 70–74 | C | 2.5 |
| 85–89 | A | 4.0 | | 65–69 | C- | 2.0 |
| 80–84 | B+ | 3.5 | | 60–64 | D | 1.0 |
| 75–79 | B | 3.0 | | <60 | F | 0.0 |

```
GPA = Σ(gradePoints × credits) / Σ(credits)
```

Only graded courses count, so in-progress subjects never drag the average down.
Under **40%** is a backlog. `src/lib/grading.ts` is imported by the seed, the API
and the browser preview alike, so a grade can never disagree between screens.

---

## Running it

```bash
cp .env.example .env      # Windows: copy .env.example .env
docker compose up --build
```

Open <http://localhost:3000> and sign in:

| Email | Password | Role |
| --- | --- | --- |
| `admin@college.edu` | `Admin@123` | ADMIN |
| `faculty@college.edu` | `Faculty@123` | FACULTY |

Change `AUTH_SECRET` and the seed passwords before deploying anywhere.

<details>
<summary>Running the app without Docker (needs a local PostgreSQL)</summary>

```bash
docker compose up -d db   # just the database, on localhost:5432
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run dev` · `build` · `typecheck` · `db:migrate` · `db:deploy` · `db:seed` ·
`db:studio` · `db:shadow` · `setup` — see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
for the full script table, the shadow-database setup and troubleshooting.

</details>

---

## Layout

```
prisma/
  schema.prisma        data model — 6 models, 3 enums
  migrations/          committed SQL migrations
  seed.ts              demo data generator
scripts/jira/setup.mjs provisions the Jira board via the REST API
src/
  app/
    (app)/             dashboard, students, courses, enrollments, grades, api-docs
    api/               10 REST endpoints
    login/             sign-in
  components/          UI + client form components
  lib/                 auth · grading · validation · users · prisma
  generated/prisma/    generated client (git-ignored)
```

---

## Quality gates

**GitHub Actions** runs three jobs on every push, all green:

| Job | What it proves |
| --- | --- |
| `verify` | `tsc --noEmit` passes and the production build succeeds |
| `migrate` | Migrations apply to a real Postgres 17 and match `schema.prisma` with no drift; the seed runs |
| `docker` | `docker compose up --build` boots, `/login` answers, and the seed lands in Postgres |

That third job exists because the first two never touch the Dockerfile — two
real build bugs got through CI until the image was actually built.

**Jira** mirrors the codebase: 5 epics, 18 stories and 70 sub-tasks, generated
from the same plan by `scripts/jira/setup.mjs` and re-runnable without creating
duplicates.

---

## Security

- Passwords are bcrypt hashed (cost 10); login does not reveal whether an email
  exists and runs a dummy compare to keep timing flat.
- Sessions are HS256 JWTs in an httpOnly cookie, unreadable from JavaScript;
  `secure` turns on automatically in production.
- `AUTH_SECRET` must be ≥32 characters or the app refuses to start.
- Every write is zod-validated and role-checked; all SQL is parameterised.

---

## License

MIT
