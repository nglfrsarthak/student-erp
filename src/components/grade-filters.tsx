"use client";

import { useRouter } from "next/navigation";

type CourseOption = {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: number;
  enrollmentCount: number;
};

/** Filters write to the URL so the mark sheet is a shareable link. */
export function GradeFilters({
  courses,
  academicYears,
  current,
}: {
  courses: CourseOption[];
  academicYears: string[];
  current: { courseId: string; semester: string; academicYear: string };
}) {
  const router = useRouter();
  const selected = courses.find((c) => c.id === current.courseId);

  function go(changes: Record<string, string>) {
    const next = { ...current, ...changes };
    const params = new URLSearchParams();
    if (next.courseId) params.set("courseId", next.courseId);
    if (next.semester) params.set("semester", next.semester);
    if (next.academicYear) params.set("academicYear", next.academicYear);
    const qs = params.toString();
    router.push(qs ? `/grades?${qs}` : "/grades");
  }

  const options = current.courseId
    ? courses.filter((c) => c.id === current.courseId || c.enrollmentCount > 0)
    : courses;

  return (
    <form
      className="card flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        go({});
      }}
    >
      <div className="min-w-[260px] flex-1">
        <label htmlFor="courseId" className="label">
          Course
        </label>
        <select
          id="courseId"
          value={current.courseId}
          onChange={(e) => {
            const c = courses.find((x) => x.id === e.target.value);
            go({ courseId: e.target.value, semester: c ? String(c.semester) : "" });
          }}
          className="input"
          required
        >
          <option value="">Select a course...</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} - {c.title} ({c.enrollmentCount} enrolled)
            </option>
          ))}
        </select>
      </div>

      <div className="w-28">
        <label htmlFor="semester" className="label">
          Semester
        </label>
        <select
          id="semester"
          value={current.semester}
          onChange={(e) => go({ semester: e.target.value })}
          className="input"
          disabled={!current.courseId}
        >
          <option value="">All</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <option key={s} value={s}>
              Sem {s}
            </option>
          ))}
        </select>
      </div>

      <div className="w-40">
        <label htmlFor="academicYear" className="label">
          Academic year
        </label>
        <select
          id="academicYear"
          value={current.academicYear}
          onChange={(e) => go({ academicYear: e.target.value })}
          className="input font-mono"
          disabled={!current.courseId}
        >
          <option value="">All terms</option>
          {academicYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={!current.courseId} className="btn-primary">
        Load sheet
      </button>

      {selected ? (
        <p className="w-full text-xs text-slate-500">
          {selected.code} carries {selected.credits} credits and belongs to
          semester {selected.semester}.
        </p>
      ) : null}
    </form>
  );
}