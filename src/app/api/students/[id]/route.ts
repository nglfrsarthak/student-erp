import { prisma } from "@/lib/prisma";
import { authenticateRequest, canWrite, fail, handle, notFound, ok } from "@/lib/api";
import { studentUpdateSchema } from "@/lib/validation";

// Next 15+: route context params are async.
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const { response } = await authenticateRequest();
    if (response) return response;

    const { id } = await params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        program: { include: { department: true } },
        enrollments: {
          include: { course: true },
          orderBy: [{ semester: "desc" }, { id: "asc" }],
        },
      },
    });

    if (!student) return notFound("Student");
    return ok(student);
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN"])) {
      return fail("Only admins can edit students", 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const parsed = studentUpdateSchema.safeParse(body);
    if (!parsed.success) return fail("Validation failed", 422, parsed.error.flatten());

    const data = parsed.data;

    const clash = await prisma.student.findFirst({
      where: {
        id: { not: id },
        OR: [
          ...(data.enrollmentNo ? [{ enrollmentNo: data.enrollmentNo }] : []),
          ...(data.email ? [{ email: data.email.toLowerCase() }] : []),
        ],
      },
      select: { enrollmentNo: true, email: true },
    });
    if (clash) {
      const field = data.enrollmentNo && clash.enrollmentNo === data.enrollmentNo
        ? "enrollmentNo"
        : "email";
      return fail(`That ${field} is already in use`, 409, {
        fields: { [field]: "Already taken" },
      });
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...data,
        ...(data.email ? { email: data.email.toLowerCase() } : {}),
      },
      include: { program: { select: { id: true, code: true, name: true } } },
    });

    return ok(student);
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN"])) {
      return fail("Only admins can delete students", 403);
    }

    const { id } = await params;

    const existing = await prisma.student.findUnique({
      where: { id },
      select: { id: true, _count: { select: { enrollments: true } } },
    });
    if (!existing) return notFound("Student");

    // Enrollments cascade (see schema). Refuse when there is academic history.
    if (existing._count.enrollments > 0) {
      return fail(
        `This student has ${existing._count.enrollments} enrollment record(s). Remove them first, or set the status to DROPPED.`,
        409,
      );
    }

    await prisma.student.delete({ where: { id } });
    return ok({ id, deleted: true });
  });
}