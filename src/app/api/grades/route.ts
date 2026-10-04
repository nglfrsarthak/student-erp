import { prisma } from "@/lib/prisma";
import { authenticateRequest, canWrite, fail, handle, ok } from "@/lib/api";
import { gradeBulkSchema, gradeUpdateSchema } from "@/lib/validation";
import { gradeForPercentage, percentageFromMarks } from "@/lib/grading";
import { recalculateCgpa } from "@/lib/users";
import { Prisma } from "@/generated/prisma/client";

/**
 * GET /api/grades?courseId=&semester=&academicYear=
 * Returns the mark sheet: enrollments plus the student + course context the
 * grade-entry grid needs.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { response } = await authenticateRequest();
    if (response) return response;

    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId");
    const semester = url.searchParams.get("semester");
    const academicYear = url.searchParams.get("academicYear");
    const studentId = url.searchParams.get("studentId");

    const where: Prisma.EnrollmentWhereInput = {
      ...(courseId ? { courseId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(semester ? { semester: Number(semester) } : {}),
      ...(academicYear ? { academicYear } : {}),
    };

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            enrollmentNo: true,
            firstName: true,
            lastName: true,
            cgpa: true,
            status: true,
          },
        },
        course: { select: { id: true, code: true, title: true, credits: true } },
      },
      orderBy: { student: { lastName: "asc" } },
      take: 500,
    });

    return ok(enrollments);
  });
}

/** PATCH /api/grades - update one enrollment's marks. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN", "FACULTY"])) {
      return fail("You do not have permission to record grades", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const parsed = gradeUpdateSchema.safeParse(body);
    if (!parsed.success) return fail("Validation failed", 422, parsed.error.flatten());

    const enrollmentId =
      (body as { enrollmentId?: string }).enrollmentId ?? "";
    if (!enrollmentId) return fail("enrollmentId is required");

    const existing = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, studentId: true },
    });
    if (!existing) return fail("Enrollment not found", 404);

    return applyMarks(existing.studentId, enrollmentId, parsed.data);
  });
}

/**
 * PUT /api/grades - bulk save a whole mark sheet in one transaction.
 * Body: { entries: [{ enrollmentId, internalMarks, finalMarks }] }
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN", "FACULTY"])) {
      return fail("You do not have permission to record grades", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const parsed = gradeBulkSchema.safeParse(body);
    if (!parsed.success) return fail("Validation failed", 422, parsed.error.flatten());
    if (parsed.data.entries.length === 0) {
      return fail("No rows submitted");
    }

    const ids = parsed.data.entries.map((e) => e.enrollmentId);
    const found = await prisma.enrollment.findMany({
      where: { id: { in: ids } },
      select: { id: true, studentId: true },
    });
    if (found.length !== ids.length) {
      return fail("Some enrollments no longer exist - reload the page", 409);
    }

    // One transaction: either the whole mark sheet saves, or none of it does.
    const savedIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const entry of parsed.data.entries) {
        const { enrollmentId, internalMarks, finalMarks } = entry;
        const percentage = percentageFromMarks(internalMarks, finalMarks);
        const { letterGrade, gradePoints } = percentage == null
          ? { letterGrade: null, gradePoints: null }
          : gradeForPercentage(percentage);

        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: {
            internalMarks,
            finalMarks,
            percentage,
            letterGrade,
            gradePoints,
            // Recording both marks implies the course is done.
            status: percentage == null ? "ENROLLED" : "COMPLETED",
          },
        });
        savedIds.push(enrollmentId);
      }
    });

    // Refresh CGPA for every student touched by this save.
    const affected = [...new Set(found.map((f) => f.studentId))];
    for (const studentId of affected) {
      await recalculateCgpa(studentId);
    }

    return ok({ updated: savedIds.length, studentsRecalculated: affected.length });
  });
}

/** Shared single-row save used by PATCH. */
async function applyMarks(
  studentId: string,
  enrollmentId: string,
  data: { internalMarks: number | null; finalMarks: number | null; status?: string },
) {
  const percentage = percentageFromMarks(data.internalMarks, data.finalMarks);
  const { letterGrade, gradePoints } = percentage == null
    ? { letterGrade: null, gradePoints: null }
    : gradeForPercentage(percentage);

  const enrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      internalMarks: data.internalMarks,
      finalMarks: data.finalMarks,
      percentage,
      letterGrade,
      gradePoints,
      ...(data.status
        ? { status: data.status as never }
        : { status: percentage == null ? "ENROLLED" : "COMPLETED" }),
    },
    include: {
      student: { select: { id: true, enrollmentNo: true, firstName: true, lastName: true, cgpa: true } },
      course: { select: { id: true, code: true, title: true, credits: true } },
    },
  });

  await recalculateCgpa(studentId);
  return ok(enrollment);
}