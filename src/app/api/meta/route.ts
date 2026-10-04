import { prisma } from "@/lib/prisma";
import { authenticateRequest, handle, ok } from "@/lib/api";

/**
 * GET /api/meta
 * Reference data for the forms: programs, departments, courses and the
 * distinct semester/academic-year pairs present in the system.
 */
export async function GET() {
  return handle(async () => {
    const { response } = await authenticateRequest();
    if (response) return response;

    const [departments, programs, courses, academicYears, semesters] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.program.findMany({
        include: { department: { select: { id: true, code: true, name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.course.findMany({
        select: { id: true, code: true, title: true, credits: true, semester: true, programId: true },
        orderBy: [{ semester: "asc" }, { code: "asc" }],
      }),
      prisma.enrollment.findMany({
        select: { academicYear: true },
        distinct: ["academicYear"],
        orderBy: { academicYear: "desc" },
      }),
      prisma.student.findMany({ select: { currentSemester: true }, distinct: ["currentSemester"] }),
    ]);

    return ok({
      departments,
      programs,
      courses,
      academicYears: academicYears.map((a) => a.academicYear),
      semesters: semesters.map((s) => s.currentSemester).sort((a, b) => a - b),
    });
  });
}