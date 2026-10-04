import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { round } from "@/lib/format";
import { CourseFilters } from "@/components/course-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "FACULTY"]);
  const params = await searchParams;

  const search = one(params.search)?.trim();
  const programId = one(params.programId);
  const semester = one(params.semester);

  const where = {
    ...(programId ? { programId } : {}),
    ...(semester ? { semester: Number(semester) } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            { title: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [courses, programs] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        program: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        enrollments: { select: { status: true, gradePoints: true } },
      },
      orderBy: [{ semester: "asc" }, { code: "asc" }],
      take: 300,
    }),
    prisma.program.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const isFiltered = Boolean(search || programId || semester);

  return (
    <div className="page">
      <PageHeader
        title="Courses"
        subtitle={
          isFiltered
            ? `${courses.length} matching course(s)`
            : `${courses.length} course(s) in the catalogue`
        }
        action={
          <Link href="/courses/new" className="btn-primary">
            Add course
          </Link>
        }
      />

      <CourseFilters
        programs={programs}
        current={{
          search: search ?? "",
          programId: programId ?? "",
          semester: semester ?? "",
        }}
      />

      <div className="card">
        {courses.length === 0 ? (
          <EmptyState
            title={isFiltered ? "No courses match" : "No courses yet"}
            description={
              isFiltered
                ? "Try a different search or clear the filters."
                : "Add your first course to the catalogue."
            }
            action={
              isFiltered ? (
                <Link href="/courses" className="btn-secondary">
                  Clear filters
                </Link>
              ) : (
                <Link href="/courses/new" className="btn-primary">
                  Add course
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Programme</th>
                  <th>Department</th>
                  <th>Sem</th>
                  <th>Credits</th>
                  <th>Hours</th>
                  <th>Enrolled</th>
                  <th>Avg grade</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const graded = c.enrollments.filter(
                    (e) => e.gradePoints != null,
                  );
                  const avg =
                    graded.length === 0
                      ? null
                      : round(
                          graded.reduce((s, e) => s + (e.gradePoints ?? 0), 0) /
                            graded.length,
                          2,
                        );
                  return (
                    <tr key={c.id}>
                      <td className="font-mono text-xs whitespace-nowrap">
                        <Link
                          href={`/courses/${c.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {c.code}
                        </Link>
                      </td>
                      <td>
                        <Link
                          href={`/courses/${c.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {c.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-500">
                          {c.program.code}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-500">
                          {c.department.code}
                        </span>
                      </td>
                      <td>{c.semester}</td>
                      <td>{c.credits}</td>
                      <td>{c.lectureHours}</td>
                      <td>{c.enrollments.length}</td>
                      <td>{avg ?? <span className="text-slate-400">-</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}