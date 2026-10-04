import { prisma } from "@/lib/prisma";
import { authenticateRequest, canWrite, fail, handle, notFound, ok } from "@/lib/api";
import { recalculateCgpa } from "@/lib/users";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN", "FACULTY"])) {
      return fail("You do not have permission to update enrollments", 403);
    }

    const { id } = await params;

    const existing = await prisma.enrollment.findUnique({
      where: { id },
      select: { id: true, studentId: true, status: true },
    });
    if (!existing) return notFound("Enrollment");

    let body: { status?: string };
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const allowed = ["ENROLLED", "COMPLETED", "DROPPED"] as const;
    if (!body.status || !allowed.includes(body.status as never)) {
      return fail(`status must be one of: ${allowed.join(", ")}`);
    }

    const enrollment = await prisma.enrollment.update({
      where: { id },
      data: { status: body.status as (typeof allowed)[number] },
      include: {
        student: { select: { id: true, enrollmentNo: true, firstName: true, lastName: true } },
        course: { select: { id: true, code: true, title: true, credits: true } },
      },
    });

    // Dropping/completing changes the CGPA denominator, so refresh it.
    if (existing.status !== "COMPLETED" || body.status !== "COMPLETED") {
      await recalculateCgpa(existing.studentId);
    }

    return ok(enrollment);
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN"])) {
      return fail("Only admins can delete enrollments", 403);
    }

    const { id } = await params;

    const existing = await prisma.enrollment.findUnique({
      where: { id },
      select: { id: true, studentId: true },
    });
    if (!existing) return notFound("Enrollment");

    await prisma.enrollment.delete({ where: { id } });
    await recalculateCgpa(existing.studentId);

    return ok({ id, deleted: true });
  });
}