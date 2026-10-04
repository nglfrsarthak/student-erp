import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { BarMeter, Badge, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { formatDateTime, fullName, round } from "@/lib/format";
import { PASS_PERCENTAGE } from "@/lib/grading";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();

  const [
    studentCount,
    activeStudentCount,
    courseCount,
    enrollmentCount,
    completedCount,
    backlogCount,
    avgCgpa,
    programBreakdown,
    topStudents,
    recentEnrollments,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { status: "COMPLETED" } }),
    prisma.enrollment.count({
      where: { status: "COMPLETED", percentage: { lt: PASS_PERCENTAGE } },
    }),
    prisma.student.aggregate({ _avg: { cgpa: true } }),
    prisma.program.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { students: true, courses: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: { cgpa: { gt: 0 } },
      select: {
        id: true,
        enrollmentNo: true,
        firstName: true,
        lastName: true,
        cgpa: true,
        program: { select: { code: true } },
      },
      orderBy: { cgpa: "desc" },
      take: 5,
    }),
    prisma.enrollment.findMany({
      select: {
        id: true,
        enrolledAt: true,
        status: true,
        student: { select: { firstName: true, lastName: true } },
        course: { select: { code: true, title: true } },
      },
      orderBy: { enrolledAt: "desc" },
      take: 8,
    }),
  ]);

  const avg = avgCgpa._avg.cgpa ?? 0;
  const maxProgramStudents = Math.max(
    1,
    ...programBreakdown.map((p) => p._count.students),
  );

  return (
    <div className="page">
      <PageHeader
        title={`Welcome back, ${session.name.split(" ")[0]}`}
        subtitle="Live figures pulled straight from the database."
        action={
          <Link href="/students/new" className="btn-primary">
            Add student
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students"
          value={studentCount}
          hint={`${activeStudentCount} active`}
          href="/students"
        />
        <StatCard
          label="Courses"
          value={courseCount}
          hint={`${programBreakdown.length} programmes`}
          href="/courses"
        />
        <StatCard
          label="Enrollments"
          value={enrollmentCount}
          hint={`${completedCount} completed`}
          href="/enrollments"
        />
        <StatCard
          label="Average CGPA"
          value={round(avg, 2)}
          hint="Across all students with grades"
          href="/grades"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="card-header">
            <div>
              <h2 className="card-title">Students by programme</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Enrolment spread across the college
              </p>
            </div>
            <Badge tone="slate">{programBreakdown.length} programmes</Badge>
          </div>

          {programBreakdown.length === 0 ? (
            <EmptyState
              title="No programmes yet"
              description="Run the seed script to load demo academic structure."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {programBreakdown.map((p) => (
                <li key={p.id} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        <span className="font-mono text-xs text-slate-500">
                          {p.code}
                        </span>{" "}
                        {p.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {p._count.courses} courses
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {p._count.students}
                    </p>
                  </div>
                  <div className="mt-2">
                    <BarMeter value={p._count.students} max={maxProgramStudents} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Academic health</h2>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-slate-600">Graded enrollments</p>
                <p className="text-sm font-semibold text-slate-900">
                  {completedCount} / {enrollmentCount}
                </p>
              </div>
              <div className="mt-2">
                <BarMeter
                  value={completedCount}
                  max={Math.max(1, enrollmentCount)}
                  tone="bg-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-slate-600">Backlogs (&lt; {PASS_PERCENTAGE}%)</p>
                <p
                  className={`text-sm font-semibold ${
                    backlogCount > 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {backlogCount}
                </p>
              </div>
              <div className="mt-2">
                <BarMeter
                  value={backlogCount}
                  max={Math.max(1, completedCount)}
                  tone="bg-red-500"
                />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Pass rate
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {completedCount === 0
                  ? "n/a"
                  : `${round(((completedCount - backlogCount) / completedCount) * 100, 1)}%`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                of completed courses above the pass mark
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Top performers</h2>
            <Link href="/students" className="text-xs font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {topStudents.length === 0 ? (
            <EmptyState
              title="No grades recorded"
              description="Record marks on the Grades page to see rankings."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {topStudents.map((s, i) => (
                <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/students/${s.id}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {fullName(s)}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {s.enrollmentNo} &middot; {s.program.code}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    {round(s.cgpa, 2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Recent enrollments</h2>
            <Link href="/enrollments" className="text-xs font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {recentEnrollments.length === 0 ? (
            <EmptyState
              title="Nothing enrolled yet"
              description="Register a student in a course to get started."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentEnrollments.map((e) => (
                <li key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {fullName(e.student)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {e.course.code} &middot; {e.course.title}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={e.status} />
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDateTime(e.enrolledAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {topStudents.length > 0 ? (
        <section className="card p-5">
          <h2 className="card-title">CGPA distribution</h2>
          <p className="mt-0.5 mb-4 text-xs text-slate-500">
            Spread of every graded student on the 4.0 scale
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Distinction (3.75+)", min: 3.75, tone: "bg-emerald-500" },
              { label: "Merit (3.5-3.74)", min: 3.5, tone: "bg-indigo-500" },
              { label: "Pass (2.5-3.49)", min: 2.5, tone: "bg-amber-500" },
              { label: "Re-appear (<2.5)", min: 0, tone: "bg-red-500" },
            ].map((band) => {
              const count = topStudents.filter((s) => s.cgpa >= band.min).length;
              return (
                <div key={band.label}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-slate-600">{band.label}</p>
                    <p className="text-sm font-semibold text-slate-900">{count}</p>
                  </div>
                  <div className="mt-2">
                    <BarMeter
                      value={count}
                      max={Math.max(1, topStudents.length)}
                      tone={band.tone}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}