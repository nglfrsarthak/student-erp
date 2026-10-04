import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { GradesGrid } from "@/components/grades-grid";
import { GradeFilters } from "@/components/grade-filters";
import { fullName, round } from "@/lib/format";
import { PASS_PERCENTAGE } from "@/lib/grading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grades" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

export default async function GradesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "FACULTY"]);
  const params = await searchParams;

  const courseId = one(params.courseId);
  const semester = one(params.semester);
  const academicYear = one(params.academicYear);

  const [courses, academicYears] = await Promise.all([
    prisma.course.findMany({
      select: {
        id: true,
        code: true,
        title: true,
        credits: true,
        semester: true,
        programId: true,
        departmentId: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ semester: "asc" }, { code: "asc" }],
    }),
    prisma.enrollment.findMany({
      select: { academicYear: true },
      distinct: ["academicYear"],
      orderBy: { academicYear: "desc" },
    }),
  ]);

  const selectedCourse = courseId ? courses.find((c) => c.id === courseId) : undefined;

  // Without a course there is no single sheet to edit, so show a picker.
  const enrollments = selectedCourse
    ? await prisma.enrollment.findMany({
        where: {
          courseId: selectedCourse.id,
          ...(semester ? { semester: Number(semester) } : {}),
          ...(academicYear ? { academicYear } : {}),
          status: { not: "DROPPED" },
        },
        include: {
          student: {
            select: {
              id: true,
              enrollmentNo: true,
              firstName: true,
              lastName: true,
              cgpa: true,
            },
          },
        },
        orderBy: { student: { lastName: "asc" } },
      })
    : [];

  const graded = enrollments.filter((e) => e.gradePoints != null);
  const classAverage =
    graded.length === 0
      ? null
      : round(
          graded.reduce((s, e) => s + (e.percentage ?? 0), 0) / graded.length,
          2,
        );
  const failures = graded.filter(
    (e) => (e.percentage ?? 100) < PASS_PERCENTAGE,
  ).length;

  return (
    <div className="page">
      <PageHeader
        title="Grades"
        subtitle="Enter internal and final marks. Letter grades and CGPA update automatically."
      />

      <GradeFilters
        courses={courses.map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          credits: c.credits,
          semester: c.semester,
          enrollmentCount: c._count.enrollments,
        }))}
        academicYears={academicYears.map((a) => a.academicYear)}
        current={{
          courseId: courseId ?? "",
          semester: semester ?? "",
          academicYear: academicYear ?? "",
        }}
      />

      {!selectedCourse ? (
        <div className="card">
          <EmptyState
            title="Choose a course to load its mark sheet"
            description="Pick a course above. Only courses with enrolled students appear."
            action={
              <Link href="/enrollments" className="btn-primary">
                Go to enrollments
              </Link>
            }
          />
        </div>
      ) : enrollments.length === 0 ? (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                {selectedCourse.code} - {selectedCourse.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedCourse.credits} credits
              </p>
            </div>
          </div>
          <EmptyState
            title="No students match this sheet"
            description={
              enrollments.length === 0 && courseId
                ? "No enrollments for this course in the selected term."
                : "Nothing to grade here."
            }
            action={
              <Link href="/enrollments" className="btn-primary">
                Enroll students first
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card p-5">
              <p className="text-sm font-medium text-slate-500">Students on sheet</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {enrollments.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">{graded.length} graded</p>
            </div>
            <div className="card p-5">
              <p className="text-sm font-medium text-slate-500">Class average</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {classAverage != null ? `${classAverage}%` : "-"}
              </p>
              <p className="mt-1 text-xs text-slate-500">saved marks only</p>
            </div>
            <div className="card p-5">
              <p className="text-sm font-medium text-slate-500">Below pass mark</p>
              <p
                className={`mt-2 text-3xl font-bold ${
                  failures > 0 ? "text-red-600" : "text-slate-900"
                }`}
              >
                {failures}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                under {PASS_PERCENTAGE}%
              </p>
            </div>
            <div className="card p-5">
              <p className="text-sm font-medium text-slate-500">Credits on sheet</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {enrollments.length * selectedCourse.credits}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedCourse.credits} per student
              </p>
            </div>
          </div>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  {selectedCourse.code} - {selectedCourse.title}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Semester {semester ?? selectedCourse.semester}
                  {academicYear ? ` - ${academicYear}` : ""} -{" "}
                  {selectedCourse.credits} credits
                </p>
              </div>
              <Link
                href={`/courses/${selectedCourse.id}`}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Course details
              </Link>
            </div>

            <div className="p-5">
              <GradesGrid
                rows={enrollments.map((e) => ({
                  enrollmentId: e.id,
                  studentId: e.student.id,
                  studentName: fullName(e.student),
                  enrollmentNo: e.student.enrollmentNo,
                  internalMarks: e.internalMarks,
                  finalMarks: e.finalMarks,
                  percentage: e.percentage,
                  letterGrade: e.letterGrade,
                  gradePoints: e.gradePoints,
                  status: e.status,
                }))}
                credits={selectedCourse.credits}
                courseCode={selectedCourse.code}
                semester={Number(semester ?? selectedCourse.semester)}
                academicYear={academicYear ?? "all terms"}
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="card-title">CGPA after this sheet</h2>
            <p className="mt-0.5 mb-4 text-xs text-slate-500">
              Recomputed from all completed courses once you save
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Current CGPA</th>
                    <th>This course</th>
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
                        {e.student.cgpa > 0 ? (
                          <Badge
                            tone={
                              e.student.cgpa >= 3.5
                                ? "green"
                                : e.student.cgpa >= 2.5
                                  ? "indigo"
                                  : "red"
                            }
                          >
                            {round(e.student.cgpa, 2)}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td>
                        {e.letterGrade ? (
                          <Badge tone="slate">
                            {e.letterGrade} ({round(e.gradePoints ?? 0, 1)})
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">Not graded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}