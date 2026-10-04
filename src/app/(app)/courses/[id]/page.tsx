import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, PageHeader, StatusBadge } from "@/components/ui";
import { formatMark, formatPercent, fullName, round } from "@/lib/format";
import {
  MAX_FINAL_MARKS,
  MAX_INTERNAL_MARKS,
  PASS_PERCENTAGE,
} from "@/lib/grading";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CourseDetailPage({ params }: Props) {
  await requireRole(["ADMIN", "FACULTY"]);
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      program: true,
      department: true,
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              enrollmentNo: true,
              firstName: true,
              lastName: true,
              cgpa: true,
              currentSemester: true,
            },
          },
        },
        orderBy: { student: { lastName: "asc" } },
      },
    },
  });

  if (!course) notFound();

  const graded = course.enrollments.filter((e) => e.gradePoints != null);
  const avgGradePoints =
    graded.length === 0
      ? null
      : round(
          graded.reduce((s, e) => s + (e.gradePoints ?? 0), 0) / graded.length,
          2,
        );
  const avgPercentage =
    graded.length === 0
      ? null
      : round(
          graded.reduce((s, e) => s + (e.percentage ?? 0), 0) / graded.length,
          2,
        );
  const passCount = graded.filter(
    (e) => (e.percentage ?? 0) >= PASS_PERCENTAGE,
  ).length;

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/courses" className="text-indigo-600 hover:underline">
          Courses
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="font-mono text-slate-500">{course.code}</span>
      </nav>

      <PageHeader
        title={course.title}
        subtitle={`${course.code} - ${course.program.code} ${course.program.name}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/grades?courseId=${course.id}&semester=${course.semester}`}
              className="btn-primary"
            >
              Record grades
            </Link>
            <Link href={`/courses/${course.id}/edit`} className="btn-secondary">
              Edit
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Credits</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{course.credits}</p>
          <p className="mt-1 text-xs text-slate-500">GPA weighted</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Enrolled</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {course.enrollments.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {graded.length} graded
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Average</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {avgPercentage != null ? `${avgPercentage}%` : "-"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {avgGradePoints != null ? `${avgGradePoints} grade pts` : "no grades yet"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Pass rate</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {graded.length === 0
              ? "n/a"
              : `${round((passCount / graded.length) * 100, 1)}%`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {passCount} of {graded.length} passed
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Course details</h2>
          </div>
          <dl className="divide-y divide-slate-100">
            {[
              { label: "Code", value: course.code },
              { label: "Title", value: course.title },
              { label: "Programme", value: `${course.program.code} - ${course.program.name}` },
              { label: "Degree", value: course.program.degree },
              { label: "Department", value: `${course.department.code} - ${course.department.name}` },
              { label: "Semester", value: `Semester ${course.semester}` },
              { label: "Credits", value: String(course.credits) },
              { label: "Lecture hours", value: `${course.lectureHours} / week` },
            ].map((row) => (
              <div key={row.label} className="flex gap-4 px-5 py-2.5">
                <dt className="w-32 shrink-0 text-xs font-medium text-slate-500">
                  {row.label}
                </dt>
                <dd className="min-w-0 flex-1 text-sm break-words text-slate-900">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">
              Students ({course.enrollments.length})
            </h2>
            <Link href="/enrollments" className="text-xs font-medium text-indigo-600 hover:underline">
              Manage enrollments
            </Link>
          </div>

          {course.enrollments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Nobody enrolled yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Register students in this course from the Enrollments page.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Enrollment no</th>
                    <th>Student</th>
                    <th>Sem</th>
                    <th>Internal</th>
                    <th>Final</th>
                    <th>Total %</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {course.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td className="font-mono text-xs whitespace-nowrap">
                        <Link
                          href={`/students/${e.student.id}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {e.student.enrollmentNo}
                        </Link>
                      </td>
                      <td>
                        <Link
                          href={`/students/${e.student.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {fullName(e.student)}
                        </Link>
                      </td>
                      <td>{e.semester}</td>
                      <td>{formatMark(e.internalMarks, MAX_INTERNAL_MARKS)}</td>
                      <td>{formatMark(e.finalMarks, MAX_FINAL_MARKS)}</td>
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
                      <td>
                        {e.letterGrade ? (
                          <Badge
                            tone={
                              (e.gradePoints ?? 0) >= 3.5
                                ? "green"
                                : (e.gradePoints ?? 0) >= 2.5
                                  ? "indigo"
                                  : "red"
                            }
                          >
                            {e.letterGrade} ({round(e.gradePoints ?? 0, 1)})
                          </Badge>
                        ) : (
                          <StatusBadge status={e.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}