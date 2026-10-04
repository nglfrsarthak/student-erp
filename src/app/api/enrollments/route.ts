import { prisma } from "@/lib/prisma";
import { authenticateRequest, canWrite, fail, handle, ok } from "@/lib/api";
import { enrollmentCreateSchema } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  return handle(async () => {
    const { response } = await authenticateRequest();
    if (response) return response;

    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId");
    const courseId = url.searchParams.get("courseId");
    const semester = url.searchParams.get("semester");
    const academicYear = url.searchParams.get("academicYear");
    const status = url.searchParams.get("status");

    const where: Prisma.EnrollmentWhereInput = {
      ...(studentId ? { studentId } : {}),
      ...(courseId ? { courseId } : {}),
      ...(semester ? { semester: Number(semester) } : {}),
      ...(academicYear ? { academicYear } : {}),
      ...(status ? { status: status as never } : {}),
    };

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        student: {
          select: { id: true, enrollmentNo: true, firstName: true, lastName: true, cgpa: true },
        },
        course: { select: { id: true, code: true, title: true, credits: true } },
      },
      orderBy: [{ enrolledAt: "desc" }],
      take: 500,
    });

    return ok(enrollments);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN", "FACULTY"])) {
      return fail("You do not have permission to manage enrollments", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const parsed = enrollmentCreateSchema.safeParse(body);
    if (!parsed.success) return fail("Validation failed", 422, parsed.error.flatten());
    const data = parsed.data;

    const [student, course] = await Promise.all([
      prisma.student.findUnique({
        where: { id: data.studentId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          programId: true,
          currentSemester: true,
        },
      }),
      prisma.course.findUnique({
        where: { id: data.courseId },
        select: { id: true, title: true, programId: true, semester: true },
      }),
    ]);

    if (!student) return fail("Student not found", 404);
    if (!course) return fail("Course not found", 404);

    if (student.status !== "ACTIVE") {
      return fail("Only ACTIVE students can be enrolled", 409);
    }
    if (course.programId !== student.programId) {
      return fail(
        "That course belongs to a different program than the student",
        409,
      );
    }

    const duplicate = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId_semester: {
          studentId: data.studentId,
          courseId: data.courseId,
          semester: data.semester,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      return fail("This student is already enrolled in that course this semester", 409);
    }

    const enrollment = await prisma.enrollment.create({
      data,
      include: {
        student: { select: { id: true, enrollmentNo: true, firstName: true, lastName: true } },
        course: { select: { id: true, code: true, title: true, credits: true } },
      },
    });

    return ok(enrollment, 201);
  });
}