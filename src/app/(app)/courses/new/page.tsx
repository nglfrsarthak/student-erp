import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CourseForm } from "@/components/course-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireRole(["ADMIN", "FACULTY"]);

  const [departments, programs] = await Promise.all([
    prisma.department.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.program.findMany({
      select: { id: true, code: true, name: true, departmentId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canCreate = departments.length > 0 && programs.length > 0;

  return (
    <div className="page max-w-3xl">
      <PageHeader
        title="Add course"
        subtitle="Courses belong to one programme and are offered in a specific semester."
      />

      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/courses" className="text-indigo-600 hover:underline">
          Courses
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-500">New</span>
      </nav>

      <div className="card p-6">
        {!canCreate ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-slate-900">
              Academic structure missing
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Departments and programmes must exist before courses can be added.
              Run <code className="font-mono">npm run db:seed</code> to load the
              demo structure.
            </p>
          </div>
        ) : (
          <CourseForm programs={programs} departments={departments} />
        )}
      </div>
    </div>
  );
}