import { prisma } from "@/lib/prisma";
import { authenticateRequest, canWrite, fail, handle, ok } from "@/lib/api";
import { studentCreateSchema } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    void session;

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const programId = url.searchParams.get("programId");
    const semester = url.searchParams.get("semester");
    const status = url.searchParams.get("status");

    const where: Prisma.StudentWhereInput = {
      ...(status ? { status: status as never } : {}),
      ...(programId ? { programId } : {}),
      ...(semester ? { currentSemester: Number(semester) } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { enrollmentNo: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const students = await prisma.student.findMany({
      where,
      include: {
        program: { select: { id: true, code: true, name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    });

    return ok(students);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN"])) {
      return fail("Only admins can create students", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const parsed = studentCreateSchema.safeParse(body);
    if (!parsed.success) return fail("Validation failed", 422, parsed.error.flatten());

    const data = parsed.data;

    // Pre-flight the unique constraints so the user gets a field-level message
    // rather than a Prisma P2002.
    const existing = await prisma.student.findFirst({
      where: { OR: [{ enrollmentNo: data.enrollmentNo }, { email: data.email }] },
      select: { enrollmentNo: true, email: true },
    });
    if (existing) {
      const field = existing.enrollmentNo === data.enrollmentNo ? "enrollmentNo" : "email";
      return fail(`That ${field} is already in use`, 409, {
        fields: { [field]: "Already taken" },
      });
    }

    const student = await prisma.student.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      },
      include: { program: { select: { id: true, code: true, name: true } } },
    });

    return ok(student, 201);
  });
}