import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, StatusBadge, Badge } from "@/components/ui";
import { fullName, round } from "@/lib/format";
import { StudentFilters } from "@/components/student-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Students" };

// Next 15+: searchParams is a Promise.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "FACULTY"]);
  const params = await searchParams;

  const search = one(params.search)?.trim();
  const programId = one(params.programId);
  const semester = one(params.semester);
  const status = one(params.status);

  const where = {
    ...(programId ? { programId } : {}),
    ...(semester ? { currentSemester: Number(semester) } : {}),
    ...(status ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { enrollmentNo: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [students, programs] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        program: { select: { id: true, code: true, name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 300,
    }),
    prisma.program.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const isFiltered = Boolean(search || programId || semester || status);

  return (
    <div className="page">
      <PageHeader
        title="Students"
        subtitle={
          isFiltered
            ? `${students.length} matching student(s)`
            : `${students.length} student(s) on record`
        }
        action={
          <Link href="/students/new" className="btn-primary">
            Add student
          </Link>
        }
      />

      <StudentFilters
        programs={programs}
        current={{
          search: search ?? "",
          programId: programId ?? "",
          semester: semester ?? "",
          status: status ?? "",
        }}
      />

      <div className="card">
        {students.length === 0 ? (
          <EmptyState
            title={isFiltered ? "No students match these filters" : "No students yet"}
            description={
              isFiltered
                ? "Try widening your search or clearing the filters."
                : "Add your first student record to get started."
            }
            action={
              isFiltered ? (
                <Link href="/students" className="btn-secondary">
                  Clear filters
                </Link>
              ) : (
                <Link href="/students/new" className="btn-primary">
                  Add student
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Enrollment no</th>
                  <th>Name</th>
                  <th>Programme</th>
                  <th>Sem</th>
                  <th>Batch</th>
                  <th>CGPA</th>
                  <th>Courses</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs whitespace-nowrap">
                      <Link
                        href={`/students/${s.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {s.enrollmentNo}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/students/${s.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {fullName(s)}
                      </Link>
                      <p className="text-xs text-slate-500">{s.email}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="font-mono text-xs text-slate-500">
                        {s.program.code}
                      </span>
                      <p className="text-xs text-slate-600">{s.program.name}</p>
                    </td>
                    <td>{s.currentSemester}</td>
                    <td>{s.batchYear}</td>
                    <td>
                      {s.cgpa > 0 ? (
                        <Badge
                          tone={
                            s.cgpa >= 3.5
                              ? "green"
                              : s.cgpa >= 2.5
                                ? "indigo"
                                : "red"
                          }
                        >
                          {round(s.cgpa, 2)}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td>{s._count.enrollments}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}