import { z } from "zod";
import { MAX_FINAL_MARKS, MAX_INTERNAL_MARKS } from "./grading";

/** Zod 4 uses top-level string formats: z.email(), not z.string().email(). */

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

const nameField = z.string().trim().min(1, "Required").max(80);

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export const studentCreateSchema = z.object({
  enrollmentNo: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only"),
  firstName: nameField,
  lastName: nameField,
  email: z.email("Enter a valid email"),
  phone: optionalTrimmed,
  gender: optionalTrimmed,
  address: optionalTrimmed,
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d == null || !Number.isNaN(d.getTime()), "Invalid date"),
  batchYear: z.coerce.number().int().min(2000).max(2100),
  currentSemester: z.coerce.number().int().min(1).max(12),
  programId: z.string().min(1, "Select a program"),
  status: z.enum(["ACTIVE", "SUSPENDED", "GRADUATED", "DROPPED"]).default("ACTIVE"),
});

export const studentUpdateSchema = studentCreateSchema.partial();

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export const courseCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only"),
  title: nameField.max(150),
  credits: z.coerce.number().int().min(0).max(12),
  semester: z.coerce.number().int().min(1).max(12),
  lectureHours: z.coerce.number().int().min(0).max(20),
  programId: z.string().min(1, "Select a program"),
  departmentId: z.string().min(1, "Select a department"),
});

export const courseUpdateSchema = courseCreateSchema.partial();

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export const enrollmentCreateSchema = z.object({
  studentId: z.string().min(1, "Select a student"),
  courseId: z.string().min(1, "Select a course"),
  semester: z.coerce.number().int().min(1).max(12),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Use the format YYYY-MM, e.g. 2026-08"),
});

export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateSchema>;

// ---------------------------------------------------------------------------
// Grades
// ---------------------------------------------------------------------------

export const markField = (max: number, label: string) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    })
    .refine((n) => n == null || (n >= 0 && n <= max), {
      message: `${label} must be between 0 and ${max}`,
    });

export const gradeUpdateSchema = z.object({
  internalMarks: markField(MAX_INTERNAL_MARKS, "Internal"),
  finalMarks: markField(MAX_FINAL_MARKS, "Final"),
  status: z.enum(["ENROLLED", "COMPLETED", "DROPPED"]).optional(),
});

export const gradeBulkSchema = z.object({
  entries: z
    .array(
      z.object({
        enrollmentId: z.string().min(1),
        internalMarks: markField(MAX_INTERNAL_MARKS, "Internal"),
        finalMarks: markField(MAX_FINAL_MARKS, "Final"),
      }),
    )
    .max(500, "Too many rows in one submission"),
});

export type GradeUpdateInput = z.infer<typeof gradeUpdateSchema>;

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

/** Flatten a ZodError into `{ field: message }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}