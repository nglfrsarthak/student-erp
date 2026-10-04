import { prisma } from "@/lib/prisma";
import { authenticateRequest, canWrite, fail, handle, notFound, ok } from "@/lib/api";
import { courseUpdateSchema } from "@/lib/validation";
import { recalculateCgpa } from "@/lib/users";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const { response } = await authenticateRequest();
    if (response) return response;

    const { id } = await params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        program: { include: { department: true } },
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
              },
            },
          },
          orderBy: { student: { lastName: "asc" } },
        },
      },
    });

    if (!course) return notFound("Course");
    return ok(course);
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN", "FACULTY"])) {
      return fail("You do not have permission to edit courses", 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const parsed = courseUpdateSchema.safeParse(body);
    if (!parsed.success) return fail("Validation failed", 422, parsed.error.flatten());

    if (parsed.data.code) {
      const clash = await prisma.course.findFirst({
        where: { code: parsed.data.code, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        return fail("That course code is already in use", 409, {
          fields: { code: "Already taken" },
        });
      }
    }

    const course = await prisma.course.update({ where: { id }, data: parsed.data });

    // Changing credits invalidates every CGPA computed from this course.
    if (parsed.data.credits != null) {
      const affected = await prisma.enrollment.findMany({
        where: { courseId: id, status: "COMPLETED" },
        select: { studentId: true },
        distinct: ["studentId"],
      });
      for (const { studentId } of affected) {
        await recalculateCgpa(studentId);
      }
    }

    return ok(course);
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN"])) {
      return fail("Only admins can delete courses", 403);
    }

    const { id } = await params;

    const existing = await prisma.course.findUnique({
      where: { id },
      select: { id: true, _count: { select: { enrollments: true } } },
    });
    if (!existing) return notFound("Course");

    if (existing._count.enrollments > 0) {
      return fail(
        `This course has ${existing._count.enrollments} enrollment(s). Delete those first.`,
        409,
      );
    }

    await prisma.course.delete({ where: { id } });
    return ok({ id, deleted: true });
  });
}