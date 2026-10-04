import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { StudentForm } from "@/components/student-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit student" };

type Props = { params: Promise<{ id: string }> };

export default async function EditStudentPage({ params }: Props) {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const [student, programs] = await Promise.all([
    prisma.student.findUnique({ where: { id } }),
    prisma.program.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!student) notFound();

  return (
    <div className="page max-w-3xl">
      <PageHeader
        title="Edit student"
        subtitle={`${student.enrollmentNo} - ${student.firstName} ${student.lastName}`}
      />

      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/students" className="text-indigo-600 hover:underline">
          Students
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <Link
          href={`/students/${student.id}`}
          className="text-indigo-600 hover:underline"
        >
          {student.enrollmentNo}
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-500">Edit</span>
      </nav>

      <div className="card p-6">
        <StudentForm
          programs={programs}
          student={{
            id: student.id,
            enrollmentNo: student.enrollmentNo,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            phone: student.phone,
            gender: student.gender,
            address: student.address,
            dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
            batchYear: student.batchYear,
            currentSemester: student.currentSemester,
            status: student.status,
            programId: student.programId,
          }}
        />
      </div>
    </div>
  );
}