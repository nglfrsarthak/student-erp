#!/usr/bin/env node
/**
 * Jira bootstrap for the Student ERP project.
 *
 * Creates the project, a scrum board, epics, stories and tasks that map to
 * what is actually in this repository. Idempotent-ish: re-running skips any
 * issue whose summary already exists.
 *
 * Usage (PowerShell):
 *   $env:JIRA_SITE   = "your-domain"
 *   $env:JIRA_EMAIL  = "you@example.com"
 *   $env:JIRA_TOKEN  = "your-api-token"
 *   $env:JIRA_PROJECT_KEY = "ERP"     # optional, default ERP
 *   node scripts/jira/setup.mjs
 *
 * Get a token: https://id.atlassian.com/manage-profile/security/api-tokens
 */

import { Buffer } from "node:buffer";

const SITE = process.env.JIRA_SITE;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN;
const PROJECT_KEY = (process.env.JIRA_PROJECT_KEY || "ERP").toUpperCase();
const DRY_RUN = process.env.JIRA_DRY_RUN === "1";

if (!SITE || !EMAIL || !TOKEN) {
  console.error(
    "Missing credentials. Set JIRA_SITE, JIRA_EMAIL and JIRA_TOKEN.\n" +
      "Token: https://id.atlassian.com/manage-profile/security/api-tokens",
  );
  process.exit(1);
}

const BASE = `https://${SITE}.atlassian.net`;
const AUTH = `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64")}`;

// ---------------------------------------------------------------------------
// Plan: 5 epics matching the 5 modules, each with stories and tasks.
// ---------------------------------------------------------------------------

const PLAN = [
  {
    epic: "Foundation: project, schema and infrastructure",
    stories: [
      {
        summary: "Docker Compose stack with PostgreSQL healthcheck",
        description:
          "docker-compose.yml defining a `db` service (postgres:17-alpine, healthcheck, named volume) and a `web` service that waits for the healthcheck, runs `prisma migrate deploy`, seeds, then starts Next.js.",
        tasks: [
          "Add postgres:17-alpine service with pg_isready healthcheck",
          "Add named volume erp-pgdata for durable storage",
          "Wire web service depends_on: service_healthy",
          "Verify `docker compose config` parses cleanly",
        ],
        labels: ["docker", "infrastructure"],
      },
      {
        summary: "Prisma 7 schema with committed SQL migration",
        description:
          "Seven models (User, Department, Program, Course, Student, Enrollment) plus three enums. Migration generated offline via `prisma migrate diff --from-empty --to-schema` so it is committed without needing a live database.",
        tasks: [
          "Define Department -> Program -> Course hierarchy",
          "Define Student with denormalised cgpa field",
          "Define Enrollment with unique (studentId, courseId, semester)",
          "Generate initial migration SQL and migration_lock.toml",
          "Verify schema with `prisma validate`",
        ],
        labels: ["prisma", "database"],
      },
      {
        summary: "Session authentication with role-based access",
        description:
          "bcrypt password hashing, HS256 JWT in an httpOnly SameSite=Lax cookie, and ADMIN / FACULTY / STUDENT guards used by both pages and API routes.",
        tasks: [
          "Implement bcrypt hash/verify with constant-time dummy compare",
          "Implement signed session cookie (jose), 8 hour expiry",
          "Add requireSession and requireRole page guards",
          "Add role checks to every mutating API route",
        ],
        labels: ["auth", "security"],
      },
      {
        summary: "GitHub Actions CI: build plus migration drift check",
        description:
          "Runs typecheck and production build, then applies migrations against a real Postgres service and fails if the committed migrations no longer match schema.prisma.",
        tasks: [
          "Add verify job (npm run typecheck && npm run build)",
          "Add migrate job with postgres service container",
          "Fail CI on schema drift using prisma migrate diff --exit-code",
          "Run the seed script against CI Postgres to prove it works",
          "NOTE: pushing ci.yml needs the `workflow` OAuth scope",
        ],
        labels: ["ci", "github"],
      },
    ],
  },
  {
    epic: "Module: Students",
    stories: [
      {
        summary: "Student CRUD with search and filters",
        description:
          "List with search across name, enrollment number and email; filters for programme, semester and status. All filters live in the URL query string so views are shareable.",
        tasks: [
          "Build list table with CGPA badge and status badge",
          "Add search input across four fields",
          "Add programme / semester / status filters via searchParams",
          "Handle the empty state for both filtered and unfiltered cases",
        ],
        labels: ["students", "ui"],
      },
      {
        summary: "Create and edit student form",
        description:
          "Shared client form used by both /students/new and /students/[id]/edit. Zod validation, per-field error display, duplicate enrollmentNo/email detection returning 409.",
        tasks: [
          "Build controlled form component with field-level errors",
          "Pre-flight unique checks for enrollmentNo and email",
          "Add optional phone, gender, date of birth and address fields",
          "Reset form state and redirect to the detail page on success",
        ],
        labels: ["students", "forms"],
      },
      {
        summary: "Student transcript and CGPA breakdown",
        description:
          "Per-student page showing internal/final marks, total percentage, letter grade, a semester-by-semester GPA table, credits earned versus required, and backlog count.",
        tasks: [
          "Render transcript table with pass/fail highlighting",
          "Group completed enrollments by term and compute term GPA",
          "Show credits earned against program totalCredits",
          "Display classification band (Distinction/Merit/Pass/Re-appear)",
        ],
        labels: ["students", "reports"],
      },
      {
        summary: "Delete guard for students with academic history",
        description:
          "Refuse deletion while enrollments exist and suggest marking the student DROPPED instead, so transcripts are never destroyed by accident.",
        tasks: [
          "Return 409 with enrollment count when history exists",
          "Add two-step confirm-then-delete button",
          "Surface the server error message inline",
        ],
        labels: ["students", "api"],
      },
    ],
  },
  {
    epic: "Module: Courses",
    stories: [
      {
        summary: "Course catalogue with programme ownership",
        description:
          "Every course belongs to one programme and one department, is offered in a specific semester, and carries credits that feed the GPA calculation.",
        tasks: [
          "Model credits, semester and lectureHours on Course",
          "List courses with filters for programme, semester and text search",
          "Show per-course average grade points and enrollment count",
        ],
        labels: ["courses", "ui"],
      },
      {
        summary: "Course create/edit with department auto-fill",
        description:
          "Selecting a programme auto-fills its owning department, since the model guarantees each programme belongs to exactly one department.",
        tasks: [
          "Auto-fill departmentId when a programme is chosen",
          "Validate course code uniqueness (409 on clash)",
          "Uppercase the code on input for consistent formatting",
        ],
        labels: ["courses", "forms"],
      },
      {
        summary: "Credits change triggers CGPA recalculation",
        description:
          "Editing a course's credit value invalidates every CGPA derived from it, so affected students are recomputed on save.",
        tasks: [
          "Detect credits in the PATCH payload",
          "Find distinct affected students on the course",
          "Recalculate CGPA for each and return a summary",
        ],
        labels: ["courses", "grading"],
      },
    ],
  },
  {
    epic: "Module: Enrollments",
    stories: [
      {
        summary: "Programme-aware enrollment form",
        description:
          "Picking a student filters the course dropdown to that student's programme, matching the server-side check so users never submit an invalid pairing.",
        tasks: [
          "Fetch active students and all courses for the dropdowns",
          "Filter eligible courses by the selected student's programme",
          "Default semester from the chosen course",
          "Reset row after success so the next one can be entered",
        ],
        labels: ["enrollments", "ui"],
      },
      {
        summary: "Enrollment business rules",
        description:
          "Reject inactive students, courses belonging to another programme, and duplicate enrollment of the same course in the same semester.",
        tasks: [
          "Validate the student and course both exist",
          "Block enrollment when student status is not ACTIVE",
          "Block when course.programId differs from student.programId",
          "Enforce the composite unique key, return 409 on conflict",
        ],
        labels: ["enrollments", "api"],
      },
      {
        summary: "Drop, reopen and term filtering",
        description:
          "Change an enrollment between ENROLLED, COMPLETED and DROPPED. Every status change recalculates the affected CGPA. Enrollments can be filtered by semester and academic year.",
        tasks: [
          "PATCH status endpoint with allowed-value check",
          "Recalculate CGPA after each status change",
          "Add semester and academic-year filter chips",
        ],
        labels: ["enrollments", "api"],
      },
    ],
  },
  {
    epic: "Module: Grades and GPA",
    stories: [
      {
        summary: "Central grading rules in one module",
        description:
          "src/lib/grading.ts owns the grade scale, mark combination and GPA formula. The seed script, the browser-side grade preview and the API all import it, so a letter grade can never disagree between screens.",
        tasks: [
          "Define the 8-band scale with grade points",
          "Combine internal (/40) and final (/60) into a percentage",
          "Implement credit-weighted GPA ignoring ungraded courses",
          "Define the 40% pass mark and backlog rule",
        ],
        labels: ["grading", "core"],
      },
      {
        summary: "Mark sheet grid with live grade preview",
        description:
          "Spreadsheet-style grid per course and term. Percentage, letter grade and class average update as you type, before anything is saved.",
        tasks: [
          "Editable internal and final inputs with max-value guards",
          "Live percentage, letter grade and colour coding per row",
          "Class average and course GPA computed from current input",
          "Track a dirty state so Save is only enabled after an edit",
        ],
        labels: ["grades", "ui"],
      },
      {
        summary: "Transactional bulk grade save with CGPA recalculation",
        description:
          "PUT /api/grades saves up to 500 rows in a single transaction, so a partial failure never leaves a mark sheet half-written. Every touched student then has CGPA recomputed.",
        tasks: [
          "Validate the whole payload before writing",
          "Verify all enrollment ids still exist (409 if stale)",
          "Wrap writes in prisma.$transaction",
          "Set each graded row to COMPLETED automatically",
          "Recalculate CGPA for distinct affected students",
        ],
        labels: ["grades", "api"],
      },
      {
        summary: "In-app API reference",
        description:
          "/api-docs renders every endpoint, its required role, sample bodies, the status-code conventions and the grading rules, generated from the same constants the code uses.",
        tasks: [
          "Table of all 22 routes with method, auth and purpose",
          "Sample request bodies for write endpoints",
          "Render the grading scale and GPA formula",
          "Add curl examples using the session cookie",
        ],
        labels: ["docs"],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  // Enforced here rather than at each call site so that no future call can
  // accidentally write while "dry run" is on.
  if (DRY_RUN && method !== "GET") {
    console.log(`  [dry-run] ${method} ${path}`);
    return { key: "DRYRUN-1", id: "0", transitions: [] };
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    const parts = [
      ...(json?.errorMessages || []),
      ...(json?.errors
        ? Object.entries(json.errors).map(([field, problem]) => `${field}: ${problem}`)
        : []),
    ];
    if (parts.length) {
      throw new Error(`${method} ${path} -> ${res.status} ${parts.join("; ")}`);
    }
    // Atlassian sometimes returns a bare 400 with an empty body, which on its
    // own tells you nothing about what was wrong with the request.
    const detail = String(text || "").trim().slice(0, 300);
    throw new Error(
      `${method} ${path} -> ${res.status} ${res.statusText}` +
        (detail ? ` (empty error body: ${detail})` : " (no error detail returned)"),
    );
  }
  return json;
}

function adf(text) {
  // Atlassian Document Format: plain paragraph per line.
  return {
    type: "doc",
    version: 1,
    content: String(text)
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
  };
}

async function createIssue(fields) {
  return api("/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}

async function transition(issueKey, transitionName) {
  const transitions = await api(`/rest/api/3/issue/${issueKey}/transitions`);
  const match = (transitions.transitions || []).find(
    (t) => t.name.toLowerCase() === transitionName.toLowerCase(),
  );
  if (!match) return false;
  await api(`/rest/api/3/issue/${issueKey}/transitions`, {
    method: "POST",
    body: JSON.stringify({ transition: { id: match.id } }),
  });
  return true;
}

async function addComment(issueKey, text) {
  await api(`/rest/api/3/issue/${issueKey}/comment`, {
    method: "POST",
    body: JSON.stringify({ body: adf(text) }),
  });
}

/** Lower-cased summary: the idempotency key for an issue. */
const summaryKey = (summary) => summary.trim().toLowerCase();

/**
 * Idempotency key for an issue.
 *
 * Child issues are scoped by parent because checklist items and story titles
 * repeat across epics -- a bare summary would silently treat them as the same
 * issue and skip creating them.
 */
const issueKeyFor = (summary, parentKey) =>
  parentKey ? `${parentKey}::${summaryKey(summary)}` : summaryKey(summary);

/** summary (lower-cased, parent-scoped) -> issue key, for the whole project. */
const existing = new Map();

/**
 * Index every issue already in the project by summary.
 *
 * Jira has no unique constraint on summaries, so this is what stops a re-run
 * after a partial failure from duplicating the whole backlog.
 */
async function loadExisting(projectKey) {
  const jql = `project = "${projectKey}" ORDER BY created ASC`;
  const record = (payload) => {
    for (const issue of payload.issues || payload.values || []) {
      const summary = issue.fields?.summary;
      if (summary) {
        existing.set(issueKeyFor(summary, issue.fields?.parent?.key), issue.key);
      }
    }
    return payload;
  };

  // Current endpoint, paginated with an opaque token.
  try {
    let token;
    for (;;) {
      const query =
        `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}` +
        `&fields=summary,parent&maxResults=100` +
        (token ? `&nextPageToken=${encodeURIComponent(token)}` : "");
      const res = record(await api(query));
      if (!res.nextPageToken) return;
      token = res.nextPageToken;
    }
  } catch {
    // Older instances only expose the classic search endpoint.
  }

  let startAt = 0;
  for (;;) {
    const res = record(
      await api(
        `/rest/api/3/search?jql=${encodeURIComponent(jql)}` +
          `&fields=summary,parent&maxResults=100&startAt=${startAt}`,
      ),
    );
    if (res.isLast || startAt + 100 >= (res.total ?? 0)) break;
    startAt += 100;
  }
}

/**
 * Create an issue, or return the key of the one that already has this summary.
 *
 * Atlassian gives no unique constraint on summaries, so idempotency has to be
 * enforced by the caller. Without this a re-run after a partial failure would
 * duplicate every epic and story.
 */
async function ensureIssue({ projectKey, summary, description, issueTypeName, parent, labels }) {
  const idKey = issueKeyFor(summary, parent);
  const found = existing.get(idKey);
  if (found) return { key: found, created: false };

  const candidates = Array.isArray(issueTypeName) ? issueTypeName : [issueTypeName];

  let lastError;
  for (const name of candidates) {
    try {
      const issue = await createIssue({
        project: { key: projectKey },
        ...(parent ? { parent: { key: parent } } : {}),
        summary,
        description: adf(description),
        issuetype: { name },
        labels,
      });
      existing.set(idKey, issue.key);
      return { key: issue.key, created: true, type: name };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Work out which issue types this project actually accepts.
 *
 * Team-managed projects (style "next-gen", simplified=true) have a fixed
 * hierarchy: an Epic may only contain Task and Subtask. They do list a "Story"
 * issue type, but creating a Story *under an Epic* is rejected with a 400 whose
 * body is empty, which looks like a bad request rather than a wrong issue type.
 * So the story level is a Task there, and the checklist level is spelled
 * "Subtask" rather than "Sub-task".
 *
 * Company-managed projects use Story and Sub-task instead.
 */
async function resolveIssueTypes(projectKey) {
  const project = await api(`/rest/api/3/project/${encodeURIComponent(projectKey)}`);
  const teamManaged = project.simplified === true || project.style === "next-gen";

  let available = new Set();
  try {
    const meta = await api(
      `/rest/api/3/issue/createmeta?projectKeys=` +
        `${encodeURIComponent(projectKey)}&expand=projects.issuetypes`,
    );
    available = new Set(
      (meta.projects?.[0]?.issuetypes || []).map((t) => t.name.toLowerCase()),
    );
  } catch {
    // createmeta can be unavailable on very new sites; fall back to defaults.
  }

  // Only offer a type the project actually has, so failures are not spent on
  // names that do not exist.
  const pick = (...names) => names.find((n) => available.size === 0 || available.has(n.toLowerCase()));

  return {
    teamManaged,
    epic: pick("Epic"),
    story: teamManaged ? pick("Task", "Story") : pick("Story", "Task"),
    // Fall back to Task if the project has no sub-task type at all.
    subtask: teamManaged
      ? [pick("Subtask", "Sub-task", "Task"), "Task"]
      : [pick("Sub-task", "Subtask", "Task"), "Task"],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Target: ${BASE}  project: ${PROJECT_KEY}`);
  if (DRY_RUN) console.log("DRY RUN - no changes will be written\n");

  // 1. Verify credentials and site ------------------------------------------
  const me = await api("/rest/api/3/myself");
  console.log(`Authenticated as ${me.displayName} (${me.emailAddress})\n`);

  // 2. Create the project ---------------------------------------------------
  let projectKey = PROJECT_KEY;
  let projectId = null;

  // Named `found`, not `existing`: the latter is the module-level issue index
  // used for idempotency, and shadowing it here broke the summary count.
  const found = await api(`/rest/api/3/project/search?keys=${PROJECT_KEY}`);
  if (found.values?.length) {
    projectKey = found.values[0].key;
    projectId = found.values[0].id;
    console.log(`Project ${projectKey} already exists - reusing it.`);
  } else {
    const created = await api("/rest/api/3/project", {
      method: "POST",
      body: JSON.stringify({
        key: PROJECT_KEY,
        name: "Student ERP",
        projectTypeKey: "software",
        projectTemplateKey: "com.atlassian.jira-core-project-templates.jira-core-scrum-project",
        description: "Campus management system: students, courses, enrollment, grades and GPA.",
        leadAccountId: me.accountId,
        assignmentType: "PROJECT_LEAD",
        url: "https://github.com/nglfrsarthak/student-erp",
      }),
    });
    projectId = created.id;
    console.log(`Created project ${projectKey}.`);
  }

  // 3. Scrum board ----------------------------------------------------------
  try {
    const agile = await api(
      `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`,
    );
    if (agile.values?.length) {
      console.log(`Scrum board already present: ${agile.values[0].name}`);
    }
  } catch {
    console.log("No board yet (created automatically with the scrum template).");
  }

  // 4. Issues ---------------------------------------------------------------
  const types = await resolveIssueTypes(projectKey);
  console.log(
    `Project style: ${types.teamManaged ? "team-managed (Task is the story unit)" : "company-managed"}\n`,
  );

  await loadExisting(projectKey);
  console.log(`Indexed ${existing.size} existing issue(s) to make this re-runnable.\n`);

  const freshKeys = [];
  let epicCount = 0;
  let storyCount = 0;
  let taskCount = 0;

  for (const group of PLAN) {
    console.log(`\n${group.epic}`);

    const epic = await ensureIssue({
      projectKey,
      summary: group.epic,
      description: group.epic,
      issueTypeName: types.epic,
      labels: ["student-erp"],
    });
    if (epic.created) {
      freshKeys.push(epic.key);
      epicCount++;
    }
    console.log(
      `  [epic] ${epic.key}  ${group.epic}${epic.created ? "" : "   (already exists)"}`,
    );

    for (const story of group.stories) {
      const issue = await ensureIssue({
        projectKey,
        summary: story.summary,
        description: story.description,
        issueTypeName: types.story,
        parent: epic.key,
        labels: ["student-erp", ...(story.labels || [])],
      });
      if (issue.created) {
        freshKeys.push(issue.key);
        storyCount++;
      }

      // Checklist items hang off the story-level issue, not the epic. Parenting
      // them to the epic would flatten all of them onto the epic and lose which
      // story each belongs to; as sub-tasks they render as a real checklist.
      const taskKeys = [];
      for (const title of story.tasks) {
        const task = await ensureIssue({
          projectKey,
          summary: title,
          description: `Task for story: ${story.summary}`,
          issueTypeName: types.subtask,
          parent: issue.key,
          labels: ["student-erp"],
        });
        taskKeys.push(task.key);
        if (task.created) {
          freshKeys.push(task.key);
          taskCount++;
        }
      }

      if (issue.created) {
        await addComment(
          issue.key,
          [
            `Source: https://github.com/nglfrsarthak/student-erp`,
            "",
            "Checklist:",
            ...story.tasks.map((t, i) => `${i + 1}. ${t}`),
          ].join("\n"),
        );
      }

      console.log(
        `  [story] ${issue.key}  ${story.summary}  (${taskKeys.length} sub-tasks)` +
          (issue.created ? "" : "   (already exists)"),
      );
    }
  }

  // 5. Move newly created work into "To Do" ----------------------------------
  let moved = 0;
  for (const key of freshKeys) {
    if (await transition(key, "To Do")) moved++;
  }

  console.log(`\n${"-".repeat(56)}`);
  console.log(`Project : ${BASE}/jira/software/projects/${projectKey}`);
  console.log(`Epics   : ${epicCount} created, ${PLAN.length} in plan`);
  console.log(`Stories : ${storyCount} created`);
  console.log(`Sub-tasks: ${taskCount} created`);
  console.log(`Moved new issues to "To Do": ${moved}/${freshKeys.length}`);
  console.log(`Repo    : https://github.com/nglfrsarthak/student-erp`);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});