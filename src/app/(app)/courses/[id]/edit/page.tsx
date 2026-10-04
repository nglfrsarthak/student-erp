import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CourseForm } from "@/components/course-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit course" };

type Props = { params: Promise<{ id: string }> };

export default async function EditCoursePage({ params }: Props) {
  await requireRole(["ADMIN", "FACULTY"]);
  const { id } = await params;

  const [course, departments, programs] = await Promise.all([
    prisma.course.findUnique({ where: { id } }),
    prisma.department.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.program.findMany({
      select: { id: true, code: true, name: true, departmentId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!course) notFound();

  return (
    <div className="page max-w-3xl">
      <PageHeader
        title="Edit course"
        subtitle={`${course.code} - ${course.title}`}
      />

      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/courses" className="text-indigo-600 hover:underline">
          Courses
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <Link href={`/courses/${course.id}`} className="text-indigo-600 hover:underline">
          {course.code}
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-500">Edit</span>
      </nav>

      <div className="card p-6">
        <CourseForm
          programs={programs}
          departments={departments}
          course={{
            id: course.id,
            code: course.code,
            title: course.title,
            credits: course.credits,
            semester: course.semester,
            lectureHours: course.lectureHours,
            programId: course.programId,
            departmentId: course.departmentId,
          }}
        />
      </div>
    </div>
  );
}