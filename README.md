# Student ERP

A campus management system covering **students, courses, enrollment, grades/GPA**
and a **dashboard** — built with Next.js (App Router), PostgreSQL and Prisma,
containerised with Docker.

<!-- Stack: Next.js 16 · React 19 · TypeScript · Prisma 7 · PostgreSQL 17 · Tailwind 4 · Docker Compose -->

---

## What it does

| Module | Highlights |
| --- | --- |
| **Dashboard** | Live counts, students-per-programme, pass rate, backlog count, top performers, CGPA distribution |
| **Students** | Full CRUD, search across name / enrollment no / email, filter by programme, semester, status, per-student transcript |
| **Courses** | Catalogue with credits, semester and owning department; shows enrolled students and class average |
| **Enrollments** | Register students with programme-aware course picker, drop / reopen, filter by term |
| **Grades** | Mark sheet grid (internal /40 + final /60), live grade preview, bulk save in one transaction, automatic CGPA recalculation |

### Grading rules

Marks are **internal out of 40** plus **final out of 60**. On save the server
derives the percentage, letter grade and grade points — clients never send them.

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
Anything under **40%** is a backlog. CGPA is stored denormalised on the student
and recomputed whenever marks, credits or enrollment status change.

---

## Quick start (Docker — recommended)

```bash
cp .env.example .env          # Windows: copy .env.example .env
docker compose up --build
```

Then open <http://localhost:3000>.

The `web` container waits for Postgres to become healthy, applies migrations and
seeds demo data before starting the server, so that single command is enough.

**Sign in with:**

| Email | Password | Role |
| --- | --- | --- |
| `admin@college.edu` | `Admin@123` | ADMIN |
| `faculty@college.edu` | `Faculty@123` | FACULTY |

Change `AUTH_SECRET` and the seed passwords in `.env` before deploying anywhere.

### Useful Docker commands

```bash
docker compose up -d --build   # start in the background
docker compose logs -f web     # follow app logs
docker compose ps              # container status
docker compose down            # stop (data is kept in the erp-pgdata volume)
docker compose down -v         # stop AND wipe the database
```

---

## Local development (no Docker for the app)

You still need a PostgreSQL instance. The quickest option is to run just the
database container:

```bash
docker compose up -d db       # Postgres on localhost:5432
npm install
npx prisma migrate deploy     # create the schema
npm run db:seed               # demo data
npm run dev                   # http://localhost:3000
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on :3000 with hot reload |
| `npm run build` | Generate the Prisma client, then production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create + apply a migration (dev, needs a live DB) |
| `npm run db:deploy` | Apply pending migrations (prod/CI) |
| `npm run db:seed` | Load demo data (idempotent) |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:shadow` | (Re)create the shadow database used by `db:migrate` |
| `npm run setup` | `generate` + `deploy` + `seed` in one go |

### The shadow database

`npm run db:migrate` (`prisma migrate dev`) needs to replay your migration
history into a disposable database in order to detect drift, and
`prisma migrate diff --from-migrations` does the same. Prisma 7 removed the
`--shadow-database-url` flag, so the location is configured in
`prisma.config.ts` from the `SHADOW_DATABASE_URL` environment variable.

Set it once and create the database:

```powershell
# .env
SHADOW_DATABASE_URL="postgresql://erp:erp_secret@localhost:5432/student_erp_shadow"

npm run db:shadow
```

It is optional. If you leave it unset, Prisma creates and drops a throwaway
database itself, which needs `CREATEDB` rights on your Postgres role. Only
`db:migrate` and the CI drift check need it — `db:deploy`, `db:seed` and the
running app do not.

---

## Project layout

```
prisma/
  schema.prisma              # data model (7 models, 3 enums)
  migrations/                # committed SQL migrations
  seed.ts                    # demo data generator
src/
  app/
    (app)/                   # authenticated shell + pages
      page.tsx               # dashboard
      students/ courses/ enrollments/ grades/ api-docs/
    api/                     # REST endpoints
    login/                   # sign-in page
  components/                # UI + client form components
  lib/
    prisma.ts                # singleton client (pg driver adapter)
    auth.ts                  # JWT session cookie, role guards
    users.ts                 # login + CGPA recalculation
    grading.ts               # grading scale, GPA  <- single source of truth
    validation.ts            # zod schemas
  generated/prisma/          # generated client (git-ignored)
```

---

## Data model

```
Department ─┬─< Program ─┬─< Course
            │            │      ^
            └─< Course   │      │
                         │      │
Student >── program ─────┘      │
   │                          │
   └──< Enrollment >───────────┘
        (studentId, courseId, semester) is UNIQUE
```

`User` is an optional portal login; `Student.userId` links it. Roles are
`ADMIN`, `FACULTY`, `STUDENT`.

---

## API

Every route takes and returns JSON, and authenticates with the same httpOnly
session cookie as the UI. Sign in with `POST /api/auth/login`, then send
`erp_session` on subsequent calls.

```bash
# sign in and save the cookie
curl -c cookies.txt -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@college.edu","password":"Admin@123"}'

# list students
curl -b cookies.txt localhost:3000/api/students

# save a whole mark sheet (one transaction)
curl -b cookies.txt -X PUT localhost:3000/api/grades \
  -H 'Content-Type: application/json' \
  -d '{"entries":[{"enrollmentId":"...","internalMarks":34,"finalMarks":52}]}'
```

Successes return `{ "ok": true, "data": ... }`, failures return
`{ "ok": false, "error": "...", "fields": { ... } }`.
Codes: 400 bad JSON · 401 no session · 403 wrong role · 404 missing ·
409 conflict · 422 validation.

The full endpoint table is also rendered in-app at **`/api-docs`**.

### Authorisation matrix

| Operation | ADMIN | FACULTY | STUDENT |
| --- | :---: | :---: | :---: |
| Read dashboard / lists | ✅ | ✅ | ✅ |
| Create students, edit students | ✅ | — | — |
| Delete students, courses, enrollments | ✅ | — | — |
| Create/edit courses | ✅ | ✅ | — |
| Manage enrollments | ✅ | ✅ | — |
| Record grades | ✅ | ✅ | — |

---

## Security notes

- Passwords are bcrypt hashed (cost 10).
- Sessions are HS256 JWTs in an httpOnly, `SameSite=Lax` cookie — unreadable from
  JavaScript. `secure` is enabled automatically in production.
- `AUTH_SECRET` must be ≥32 characters or the app throws at startup.
- Login does not reveal whether an email exists, and runs a dummy bcrypt
  compare when the user is unknown to keep the timing flat.
- Every write is validated with zod and guarded by a role check.

---

## Jira project

`scripts/jira/setup.mjs` provisions the tracker through the Atlassian REST API:
it creates the project, a scrum board, **5 epics**, **17 stories** and their
task checklists, all mapped to the code in this repository, then moves
everything to **To Do**.

```powershell
# 1. Create an API token: https://id.atlassian.com/manage-profile/security/api-tokens
$env:JIRA_SITE   = "your-domain"          # your-domain.atlassian.net
$env:JIRA_EMAIL  = "you@example.com"
$env:JIRA_TOKEN  = "your-api-token"
$env:JIRA_PROJECT_KEY = "ERP"             # optional, defaults to ERP

# 2. Preview the plan without writing anything
$env:JIRA_DRY_RUN = "1"; node scripts/jira/setup.mjs

# 3. Create it
node scripts/jira/setup.mjs
```

Set `JIRA_DRY_RUN=1` to authenticate, read the project and print the plan
without writing anything.

Notes on how it behaves:

- **Re-running is safe.** It indexes the existing project by summary first and
  skips anything already there, so a run that fails halfway can simply be
  repeated. Checklist items are scoped to their parent story, because titles
  like "Recalculate CGPA for distinct affected students" appear under more than
  one story.
- **It adapts to the project style.** A team-managed project (`style=next-gen`,
  which is what the Jira wizard creates by default) does not accept a `Story`
  under an `Epic` — only `Task` and `Subtask` — so there the 17 stories are
  created as `Task` and the checklists as `Subtask`. A company-managed project
  gets `Story` and `Sub-task`. The script detects which and adapts.
- It reuses an existing project with a matching key rather than creating a
  second one.

Every issue description links back to this repository, and each story comment
carries its implementation checklist.

---

## Troubleshooting

**`Cannot apply unknown utility class`** — stale CSS cache; `rm -rf .next` and
rebuild.

**Docker: `failed to connect to the docker API ... npipe`** — Docker Desktop is
not running. Start it and wait for the whale icon to settle.

**Docker: engine never becomes ready** — Docker Desktop needs WSL2 on Windows.
If `wsl --status` says WSL is not installed, run this in an **administrator**
PowerShell and reboot:

```powershell
wsl --install
```

**`SASL ... client password must be a string`** — `DATABASE_URL` is missing or
unreadable. Confirm `.env` exists and that `prisma.config.ts` is loading it.

**`P3009 migrate failed`** — a previous migration is in a failed state. For local
work reset with `docker compose down -v` and start again.

---

## License

MIT