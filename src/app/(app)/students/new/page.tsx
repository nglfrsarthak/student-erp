import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { StudentForm } from "@/components/student-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New student" };

export default async function NewStudentPage() {
  await requireRole(["ADMIN"]);

  const programs = await prisma.program.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="page max-w-3xl">
      <PageHeader
        title="Add student"
        subtitle="Create a student record and assign them to a programme."
      />

      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/students" className="text-indigo-600 hover:underline">
          Students
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-500">New</span>
      </nav>

      <div className="card p-6">
        {programs.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-slate-900">
              No programmes exist yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Run the seed script to load demo programmes, or add one directly in
              Prisma Studio.
            </p>
            <Link href="/api-docs" className="btn-secondary mt-4">
              API reference
            </Link>
          </div>
        ) : (
          <StudentForm programs={programs} />
        )}
      </div>
    </div>
  );
}