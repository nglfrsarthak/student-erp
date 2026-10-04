import { prisma } from "@/lib/prisma";
import { authenticateRequest, canWrite, fail, handle, ok } from "@/lib/api";
import { courseCreateSchema } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  return handle(async () => {
    const { response } = await authenticateRequest();
    if (response) return response;

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const programId = url.searchParams.get("programId");
    const semester = url.searchParams.get("semester");
    const departmentId = url.searchParams.get("departmentId");

    const where: Prisma.CourseWhereInput = {
      ...(programId ? { programId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(semester ? { semester: Number(semester) } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const courses = await prisma.course.findMany({
      where,
      include: {
        program: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ semester: "asc" }, { code: "asc" }],
      take: 500,
    });

    return ok(courses);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { session, response } = await authenticateRequest();
    if (response) return response;
    if (!canWrite(session, ["ADMIN", "FACULTY"])) {
      return fail("You do not have permission to create courses", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const parsed = courseCreateSchema.safeParse(body);
    if (!parsed.success) return fail("Validation failed", 422, parsed.error.flatten());

    const clash = await prisma.course.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });
    if (clash) {
      return fail("That course code is already in use", 409, {
        fields: { code: "Already taken" },
      });
    }

    const course = await prisma.course.create({
      data: parsed.data,
      include: {
        program: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
      },
    });

    return ok(course, 201);
  });
}