"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type FieldErrors = Record<string, string>;

type StudentOption = {
  id: string;
  enrollmentNo: string;
  name: string;
  programId: string;
  status: string;
};

type CourseOption = {
  id: string;
  code: string;
  title: string;
  programId: string;
  semester: number;
};

/** Turn "2026-08" into "2026-2027". */
function termLabel(academicYear: string): string {
  const [start] = academicYear.split("-");
  if (!start) return academicYear;
  return `${start}-${Number(start) + 1}`;
}

/** Default to the current academic year based on the month. */
function defaultAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const startYear = month >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(month >= 6 ? 1 : 7).padStart(2, "0")}`;
}

export function EnrollmentForm({
  students,
  courses,
}: {
  students: StudentOption[];
  courses: CourseOption[];
}) {
  const router = useRouter();

  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [semester, setSemester] = useState(1);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const student = students.find((s) => s.id === studentId);

  // Only offer courses from the selected student's programme. This mirrors the
  // server-side check in POST /api/enrollments, it just avoids the round trip.
  const eligibleCourses = useMemo(
    () => (student ? courses.filter((c) => c.programId === student.programId) : []),
    [courses, student],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          courseId,
          semester: Number(semester),
          academicYear,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error ?? "Could not create the enrollment");
        setErrors(json.fields ?? {});
        return;
      }

      setSuccess(
        `Enrolled ${student?.name ?? "student"} in ${json.data.course.code}.`,
      );
      // Reset so the same form can take the next row.
      setStudentId("");
      setCourseId("");
      router.refresh();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          {formError}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
        >
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="studentId" className="label">
            Student
          </label>
          <select
            id="studentId"
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setCourseId("");
            }}
            className={`input ${errors.studentId ? "input-error" : ""}`}
            required
          >
            <option value="">Select a student...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.enrollmentNo} - {s.name}
              </option>
            ))}
          </select>
          {errors.studentId ? (
            <p className="field-error">{errors.studentId}</p>
          ) : (
            <p className="help">
              {student && student.status !== "ACTIVE"
                ? "Note: this student is not ACTIVE"
                : "Only active students are listed"}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="courseId" className="label">
            Course
          </label>
          <select
            id="courseId"
            value={courseId}
            onChange={(e) => {
              const c = courses.find((x) => x.id === e.target.value);
              if (c) setSemester(c.semester);
              setCourseId(e.target.value);
            }}
            disabled={!studentId}
            className={`input ${errors.courseId ? "input-error" : ""} disabled:bg-slate-50 disabled:text-slate-400`}
            required
          >
            <option value="">
              {studentId ? "Select a course..." : "Pick a student first"}
            </option>
            {eligibleCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title} (Sem {c.semester})
              </option>
            ))}
          </select>
          {errors.courseId ? (
            <p className="field-error">{errors.courseId}</p>
          ) : eligibleCourses.length === 0 && studentId ? (
            <p className="field-error">
              No courses exist for this student&apos;s programme.
            </p>
          ) : (
            <p className="help">Filtered to the student&apos;s programme</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="semester" className="label">
            Semester
          </label>
          <select
            id="semester"
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className="input"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="academicYear" className="label">
            Academic year
          </label>
          <input
            id="academicYear"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className={`input font-mono ${errors.academicYear ? "input-error" : ""}`}
            placeholder="2026-08"
            pattern="\d{4}-\d{2}"
            required
          />
          {errors.academicYear ? (
            <p className="field-error">{errors.academicYear}</p>
          ) : (
            <p className="help">
              Month 08 = Aug-Dec, 01 = Jan-May. Term: {termLabel(academicYear)}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || !studentId || !courseId}
        className="btn-primary"
      >
        {busy ? "Enrolling..." : "Enroll student"}
      </button>
    </form>
  );
}