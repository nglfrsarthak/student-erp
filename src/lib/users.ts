import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { calculateGpa } from "./grading";

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { student: { select: { id: true } } },
  });

  // Always run a bcrypt compare so a missing user and a wrong password take
  // roughly the same time (avoids leaking which emails exist).
  const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await verifyPassword(password, hash);
  if (!user || !ok) return null;

  return user;
}

/**
 * Recompute and persist a student's CGPA from their graded enrollments.
 * Call this after any change to enrollment marks.
 */
export async function recalculateCgpa(studentId: string): Promise<number> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "COMPLETED" },
    select: { gradePoints: true, course: { select: { credits: true } } },
  });

  const cgpa = calculateGpa(
    enrollments.map((e) => ({
      gradePoints: e.gradePoints,
      credits: e.course.credits,
    })),
  );

  await prisma.student.update({ where: { id: studentId }, data: { cgpa } });
  return cgpa;
}

/** Recompute CGPA for every student. Used by the seed script. */
export async function recalculateAllCgpa(): Promise<void> {
  const ids = await prisma.student.findMany({ select: { id: true } });
  for (const { id } of ids) {
    await recalculateCgpa(id);
  }
}