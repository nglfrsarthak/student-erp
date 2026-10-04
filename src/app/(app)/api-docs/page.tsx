import { PageHeader } from "@/components/ui";
import { GRADE_SCALE, MAX_FINAL_MARKS, MAX_INTERNAL_MARKS, PASS_PERCENTAGE } from "@/lib/grading";

export const metadata = { title: "API reference" };

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  auth: string;
  who: string;
  purpose: string;
  body?: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/auth/login",
    auth: "none",
    who: "everyone",
    purpose: "Exchange email + password for an httpOnly session cookie.",
    body: `{ "email": "admin@college.edu", "password": "Admin@123" }`,
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    auth: "session",
    who: "everyone",
    purpose: "Clear the session cookie.",
  },
  {
    method: "GET",
    path: "/api/meta",
    auth: "session",
    who: "everyone",
    purpose: "Reference data for forms: departments, programmes, courses, terms.",
  },
  {
    method: "GET",
    path: "/api/students",
    auth: "session",
    who: "everyone",
    purpose:
      "List students. Query: search, programId, semester, status. Max 500 rows.",
  },
  {
    method: "POST",
    path: "/api/students",
    auth: "session",
    who: "ADMIN",
    purpose: "Create a student. Rejects duplicate enrollmentNo or email with 409.",
    body: `{
  "enrollmentNo": "CSE-2021-014",
  "firstName": "Aarav",
  "lastName": "Sharma",
  "email": "aarav@college.edu",
  "phone": "+91 98765 43210",
  "dateOfBirth": "2003-04-18",
  "gender": "Male",
  "batchYear": 2021,
  "currentSemester": 5,
  "programId": "<program id>",
  "status": "ACTIVE"
}`,
  },
  {
    method: "GET",
    path: "/api/students/{id}",
    auth: "session",
    who: "everyone",
    purpose: "One student with programme, department and full enrollment history.",
  },
  {
    method: "PATCH",
    path: "/api/students/{id}",
    auth: "session",
    who: "ADMIN",
    purpose: "Partial update. Only the fields you send are changed.",
  },
  {
    method: "DELETE",
    path: "/api/students/{id}",
    auth: "session",
    who: "ADMIN",
    purpose: "Delete. Returns 409 if the student still has enrollments.",
  },
  {
    method: "GET",
    path: "/api/courses",
    auth: "session",
    who: "everyone",
    purpose: "List courses. Query: search, programId, semester, departmentId.",
  },
  {
    method: "POST",
    path: "/api/courses",
    auth: "session",
    who: "ADMIN, FACULTY",
    purpose: "Create a course.",
    body: `{
  "code": "CS301",
  "title": "Data Structures and Algorithms",
  "credits": 4,
  "semester": 3,
  "lectureHours": 4,
  "programId": "<program id>",
  "departmentId": "<department id>"
}`,
  },
  {
    method: "GET",
    path: "/api/courses/{id}",
    auth: "session",
    who: "everyone",
    purpose: "One course plus every enrolled student.",
  },
  {
    method: "PATCH",
    path: "/api/courses/{id}",
    auth: "session",
    who: "ADMIN, FACULTY",
    purpose:
      "Partial update. Changing credits recalculates CGPA for all affected students.",
  },
  {
    method: "DELETE",
    path: "/api/courses/{id}",
    auth: "session",
    who: "ADMIN",
    purpose: "Delete. Returns 409 if the course has enrollments.",
  },
  {
    method: "GET",
    path: "/api/enrollments",
    auth: "session",
    who: "everyone",
    purpose:
      "List enrollments. Query: studentId, courseId, semester, academicYear, status.",
  },
  {
    method: "POST",
    path: "/api/enrollments",
    auth: "session",
    who: "ADMIN, FACULTY",
    purpose:
      "Enroll a student. Rejects inactive students, courses from another programme, and duplicates in the same semester.",
    body: `{
  "studentId": "<student id>",
  "courseId": "<course id>",
  "semester": 5,
  "academicYear": "2026-08"
}`,
  },
  {
    method: "PATCH",
    path: "/api/enrollments/{id}",
    auth: "session",
    who: "ADMIN, FACULTY",
    purpose:
      "Change status to ENROLLED, COMPLETED or DROPPED. Recalculates CGPA.",
    body: `{ "status": "COMPLETED" }`,
  },
  {
    method: "DELETE",
    path: "/api/enrollments/{id}",
    auth: "session",
    who: "ADMIN",
    purpose: "Delete an enrollment and recalculate the student's CGPA.",
  },
  {
    method: "GET",
    path: "/api/grades",
    auth: "session",
    who: "everyone",
    purpose: "Mark sheet rows. Query: courseId, studentId, semester, academicYear.",
  },
  {
    method: "PATCH",
    path: "/api/grades",
    auth: "session",
    who: "ADMIN, FACULTY",
    purpose: "Save one student's marks.",
    body: `{
  "enrollmentId": "<enrollment id>",
  "internalMarks": 34,
  "finalMarks": 52
}`,
  },
  {
    method: "PUT",
    path: "/api/grades",
    auth: "session",
    who: "ADMIN, FACULTY",
    purpose:
      "Save a whole mark sheet in one transaction. Max 500 rows. Any failure rolls the whole save back.",
    body: `{
  "entries": [
    { "enrollmentId": "<id 1>", "internalMarks": 34, "finalMarks": 52 },
    { "enrollmentId": "<id 2>", "internalMarks": 28, "finalMarks": 41 }
  ]
}`,
  },
];

const METHOD_TONE: Record<string, string> = {
  GET: "bg-sky-100 text-sky-800",
  POST: "bg-emerald-100 text-emerald-800",
  PATCH: "bg-amber-100 text-amber-800",
  PUT: "bg-indigo-100 text-indigo-800",
  DELETE: "bg-red-100 text-red-800",
};

export default function ApiDocsPage() {
  return (
    <div className="page max-w-5xl">
      <PageHeader
        title="API reference"
        subtitle="Every route is JSON in / JSON out and uses the same session cookie as the UI."
      />

      <section className="card p-5">
        <h2 className="card-title">Conventions</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>
            <strong>Auth:</strong> sign in via <code className="font-mono">POST /api/auth/login</code>,
            then send the <code className="font-mono">erp_session</code> cookie. It is
            httpOnly, so browser code cannot read it - use <code className="font-mono">credentials: &quot;include&quot;</code> on cross-origin calls.
          </li>
          <li>
            <strong>Envelope:</strong> successes return{" "}
            <code className="font-mono">{"{ ok: true, data }"}</code>, failures return{" "}
            <code className="font-mono">{"{ ok: false, error, fields? }"}</code>.
          </li>
          <li>
            <strong>Status codes:</strong> 400 bad JSON, 401 no session, 403 wrong
            role, 404 missing, 409 conflict (duplicate or business rule), 422
            validation.
          </li>
          <li>
            <strong>Try it:</strong>{" "}
            <code className="font-mono">curl -c cookies.txt -X POST localhost:3000/api/auth/login -H &apos;Content-Type: application/json&apos; -d &apos;{'{"email":"admin@college.edu","password":"Admin@123"}'}&apos;</code>{" "}
            then add <code className="font-mono">-b cookies.txt</code> to other calls.
          </li>
        </ul>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Endpoints</h2>
          <span className="text-xs text-slate-500">{ENDPOINTS.length} routes</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {ENDPOINTS.map((e) => (
            <li key={`${e.method} ${e.path}`} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`badge font-mono font-semibold ${METHOD_TONE[e.method]}`}
                >
                  {e.method}
                </span>
                <code className="font-mono text-sm font-medium text-slate-900">
                  {e.path}
                </code>
                <span className="ml-auto text-xs text-slate-500">
                  {e.auth === "none" ? "no auth" : e.auth} &middot; {e.who}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{e.purpose}</p>
              {e.body ? (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
                  <code>{e.body}</code>
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="card-title">Grading rules</h2>
        <p className="mt-0.5 mb-4 text-sm text-slate-600">
          Marks are <strong>internal out of {MAX_INTERNAL_MARKS}</strong> plus{" "}
          <strong>final out of {MAX_FINAL_MARKS}</strong>. Percentage, letter grade
          and grade points are derived on save - clients never send them.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[...GRADE_SCALE].reverse().map((band) => (
            <div
              key={band.letterGrade}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
            >
              <span className="text-sm font-semibold text-slate-900">
                {band.letterGrade}
              </span>
              <span className="font-mono text-xs text-slate-500">
                {band.minPercentage}%+ &middot; {band.gradePoints.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600">
          GPA is credit weighted:{" "}
          <code className="font-mono text-xs">
            sum(gradePoints x credits) / sum(credits)
          </code>
          . Courses with no marks yet are excluded. Anything below{" "}
          {PASS_PERCENTAGE}% is a backlog.
        </p>
      </section>
    </div>
  );
}