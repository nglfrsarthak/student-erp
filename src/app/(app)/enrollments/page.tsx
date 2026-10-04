import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, StatusBadge, Badge } from "@/components/ui";
import { EnrollmentForm } from "@/components/enrollment-form";
import { EnrollmentStatusButton } from "@/components/enrollment-status-button";
import { formatDateTime, formatPercent, fullName } from "@/lib/format";
import { PASS_PERCENTAGE } from "@/lib/grading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enrollments" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "FACULTY"]);
  const params = await searchParams;

  const semester = one(params.semester);
  const academicYear = one(params.academicYear);
  const status = one(params.status);

  const where = {
    ...(semester ? { semester: Number(semester) } : {}),
    ...(academicYear ? { academicYear } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [enrollments, students, courses] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            enrollmentNo: true,
            firstName: true,
            lastName: true,
            programId: true,
            status: true,
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            credits: true,
            semester: true,
            programId: true,
          },
        },
      },
      orderBy: [{ academicYear: "desc" }, { semester: "desc" }, { enrolledAt: "desc" }],
      take: 300,
    }),
    prisma.student.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        enrollmentNo: true,
        firstName: true,
        lastName: true,
        programId: true,
        status: true,
      },
      orderBy: [{ lastName: "asc" }],
    }),
    prisma.course.findMany({
      select: {
        id: true,
        code: true,
        title: true,
        semester: true,
        programId: true,
      },
      orderBy: [{ semester: "asc" }, { code: "asc" }],
    }),
  ]);

  const distinctYears = await prisma.enrollment.findMany({
    select: { academicYear: true },
    distinct: ["academicYear"],
    orderBy: { academicYear: "desc" },
  });

  const isFiltered = Boolean(semester || academicYear || status);

  return (
    <div className="page">
      <PageHeader
        title="Enrollments"
        subtitle={
          isFiltered
            ? `${enrollments.length} matching row(s)`
            : `${enrollments.length} enrollment(s)`
        }
      />

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Register a student</h2>
          <p className="text-xs text-slate-500">
            Courses are limited to the student&apos;s programme
          </p>
        </div>
        <div className="p-5">
          {students.length === 0 || courses.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              You need at least one active student and one course before you can
              enroll anyone.
            </p>
          ) : (
            <EnrollmentForm
              students={students.map((s) => ({
                id: s.id,
                enrollmentNo: s.enrollmentNo,
                name: fullName(s),
                programId: s.programId,
                status: s.status,
              }))}
              courses={courses}
            />
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">All enrollments</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/enrollments" className="btn-secondary btn-sm">
              All
            </Link>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <Link
                key={s}
                href={`/enrollments?semester=${s}`}
                className={`btn-sm btn ${
                  semester === String(s)
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                S{s}
              </Link>
            ))}
          </div>
        </div>

        {isFiltered ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs text-slate-600">
            {semester ? <Badge tone="indigo">Semester {semester}</Badge> : null}
            {academicYear ? <Badge tone="slate">{academicYear}</Badge> : null}
            {status ? <Badge tone="amber">{status}</Badge> : null}
            <Link href="/enrollments" className="ml-auto text-indigo-600 hover:underline">
              Clear filters
            </Link>
          </div>
        ) : null}

        {distinctYears.length > 1 && !academicYear ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
            <span className="text-xs font-medium text-slate-500">Academic year:</span>
            {distinctYears.map((y) => (
              <Link
                key={y.academicYear}
                href={`/enrollments?academicYear=${y.academicYear}`}
                className="btn-secondary btn-sm font-mono"
              >
                {y.academicYear}
              </Link>
            ))}
          </div>
        ) : null}

        {enrollments.length === 0 ? (
          <EmptyState
            title={isFiltered ? "No enrollments match" : "No enrollments yet"}
            description={
              isFiltered
                ? "Clear the filters to see everything."
                : "Use the form above to register your first student."
            }
            action={
              isFiltered ? (
                <Link href="/enrollments" className="btn-secondary">
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Credits</th>
                  <th>Term</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Enrolled</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={`/students/${e.student.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {fullName(e.student)}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">
                        {e.student.enrollmentNo}
                      </p>
                    </td>
                    <td>
                      <Link
                        href={`/courses/${e.course.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {e.course.code}
                      </Link>
                      <p className="text-xs text-slate-500">{e.course.title}</p>
                    </td>
                    <td>{e.course.credits}</td>
                    <td className="whitespace-nowrap">
                      {e.academicYear}
                      <span className="block text-xs text-slate-500">
                        Sem {e.semester}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
                    <td>
                      {e.percentage == null ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <span
                          className={
                            e.percentage < PASS_PERCENTAGE
                              ? "font-semibold text-red-600"
                              : "font-medium text-slate-900"
                          }
                        >
                          {formatPercent(e.percentage)}
                        </span>
                      )}
                    </td>
                    <td className="text-xs whitespace-nowrap text-slate-500">
                      {formatDateTime(e.enrolledAt)}
                    </td>
                    <td className="text-right">
                      <EnrollmentStatusButton
                        enrollment={{
                          id: e.id,
                          status: e.status,
                          percentage: e.percentage,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}