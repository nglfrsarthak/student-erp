import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, PageHeader, StatusBadge } from "@/components/ui";
import { DeleteStudentButton } from "@/components/delete-student-button";
import {
  classifyCgpa,
  GRADE_SCALE,
  MAX_FINAL_MARKS,
  MAX_INTERNAL_MARKS,
  PASS_PERCENTAGE,
} from "@/lib/grading";
import {
  formatDate,
  formatMark,
  formatPercent,
  fullName,
  round,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StudentDetailPage({ params }: Props) {
  await requireRole(["ADMIN", "FACULTY"]);
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      program: { include: { department: true } },
      enrollments: {
        include: { course: { select: { code: true, title: true, credits: true } } },
        orderBy: [{ semester: "desc" }, { id: "asc" }],
      },
    },
  });

  if (!student) notFound();

  const completed = student.enrollments.filter((e) => e.status === "COMPLETED");
  const creditsEarned = completed.reduce((sum, e) => sum + e.course.credits, 0);
  const backlogs = completed.filter(
    (e) => e.percentage != null && e.percentage < PASS_PERCENTAGE,
  );
  const activeEnrollments = student.enrollments.filter((e) => e.status === "ENROLLED");
  const classification = classifyCgpa(student.cgpa);

  // Semester-wise performance, highest semester first.
  const bySemester = new Map<
    string,
    { semester: number; academicYear: string; credits: number; points: number }
  >();
  for (const e of completed) {
    const key = `${e.academicYear}-S${e.semester}`;
    const entry =
      bySemester.get(key) ??
      { semester: e.semester, academicYear: e.academicYear, credits: 0, points: 0 };
    if (e.gradePoints != null) {
      entry.credits += e.course.credits;
      entry.points += e.gradePoints * e.course.credits;
    }
    bySemester.set(key, entry);
  }
  const semesterRows = [...bySemester.entries()]
    .sort((a, b) => b[1].semester - a[1].semester)
    .map(([key, v]) => ({
      key,
      ...v,
      gpa: v.credits === 0 ? 0 : round(v.points / v.credits, 2),
    }));

  const info = [
    { label: "Email", value: student.email },
    { label: "Phone", value: student.phone ?? "-" },
    { label: "Date of birth", value: formatDate(student.dateOfBirth) },
    { label: "Gender", value: student.gender ?? "-" },
    { label: "Batch year", value: String(student.batchYear) },
    { label: "Current semester", value: String(student.currentSemester) },
    {
      label: "Programme",
      value: `${student.program.code} - ${student.program.name}`,
    },
    { label: "Department", value: student.program.department.name },
    { label: "Address", value: student.address ?? "-" },
    { label: "Enrolled on", value: formatDate(student.createdAt) },
  ];

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/students" className="text-indigo-600 hover:underline">
          Students
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="font-mono text-slate-500">{student.enrollmentNo}</span>
      </nav>

      <PageHeader
        title={fullName(student)}
        subtitle={`${student.enrollmentNo} - ${student.program.code} ${student.program.name}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/students/${student.id}/edit`}
              className="btn-secondary"
            >
              Edit
            </Link>
            <DeleteStudentButton studentId={student.id} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">CGPA</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {student.cgpa > 0 ? round(student.cgpa, 2) : "-"}
          </p>
          <div className="mt-2">
            <Badge
              tone={
                student.cgpa >= 3.75
                  ? "green"
                  : student.cgpa >= 3.5
                    ? "indigo"
                    : student.cgpa >= 2.5
                      ? "amber"
                      : "red"
              }
            >
              {classification}
            </Badge>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Credits earned</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{creditsEarned}</p>
          <p className="mt-1 text-xs text-slate-500">
            of {student.program.totalCredits} required
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Courses in progress</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {activeEnrollments.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">awaiting results</p>
        </div>

        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Backlogs</p>
          <p
            className={`mt-2 text-3xl font-bold ${
              backlogs.length > 0 ? "text-red-600" : "text-slate-900"
            }`}
          >
            {backlogs.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">below {PASS_PERCENTAGE}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <div className="card-header">
            <h2 className="card-title">Profile</h2>
            <StatusBadge status={student.status} />
          </div>
          <dl className="divide-y divide-slate-100">
            {info.map((row) => (
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
            <h2 className="card-title">Transcript</h2>
            <span className="text-xs text-slate-500">
              Internal /{MAX_INTERNAL_MARKS} + Final /{MAX_FINAL_MARKS}
            </span>
          </div>

          {student.enrollments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-slate-900">
                No enrollments yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Register this student in a course to build their transcript.
              </p>
              <Link href="/enrollments" className="btn-primary mt-4">
                Go to enrollments
              </Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Sem</th>
                    <th>Credits</th>
                    <th>Internal</th>
                    <th>Final</th>
                    <th>Total %</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {student.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span className="font-mono text-xs text-slate-500">
                          {e.course.code}
                        </span>
                        <p className="text-sm font-medium text-slate-900">
                          {e.course.title}
                        </p>
                      </td>
                      <td className="whitespace-nowrap">
                        {e.academicYear}
                        <span className="block text-xs text-slate-500">
                          Sem {e.semester}
                        </span>
                      </td>
                      <td>{e.course.credits}</td>
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

      {semesterRows.length > 0 ? (
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Semester performance</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Credits</th>
                  <th>GPA</th>
                </tr>
              </thead>
              <tbody>
                {semesterRows.map((row) => (
                  <tr key={row.key}>
                    <td className="font-medium text-slate-900">
                      Semester {row.semester}
                      <span className="ml-2 text-xs text-slate-500">
                        {row.academicYear}
                      </span>
                    </td>
                    <td>{row.credits}</td>
                    <td>
                      <Badge
                        tone={
                          row.gpa >= 3.5 ? "green" : row.gpa >= 2.5 ? "indigo" : "red"
                        }
                      >
                        {row.gpa}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card p-5">
        <h2 className="card-title">Grading scale in use</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">
          Applied automatically when marks are saved
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
                {band.minPercentage}%+ &middot; {band.gradePoints.toFixed(1)} pts
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}