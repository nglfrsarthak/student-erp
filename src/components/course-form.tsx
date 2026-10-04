"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FieldErrors = Record<string, string>;

type Program = { id: string; code: string; name: string; departmentId: string };
type Department = { id: string; code: string; name: string };

type CourseRow = {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: number;
  lectureHours: number;
  programId: string;
  departmentId: string;
};

const EMPTY: CourseRow = {
  id: "",
  code: "",
  title: "",
  credits: 3,
  semester: 1,
  lectureHours: 3,
  programId: "",
  departmentId: "",
};

export function CourseForm({
  programs,
  departments,
  course,
}: {
  programs: Program[];
  departments: Department[];
  course?: CourseRow;
}) {
  const router = useRouter();
  const editing = Boolean(course?.id);

  const [form, setForm] = useState<CourseRow>(course ? { ...EMPTY, ...course } : EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof CourseRow>(key: K, value: CourseRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const k = key as string;
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  }

  /**
   * Convenience: choosing a programme auto-fills its owning department, since
   * every programme belongs to exactly one department in this model.
   */
  function pickProgram(programId: string) {
    const program = programs.find((p) => p.id === programId);
    setForm((f) => ({
      ...f,
      programId,
      departmentId: program ? program.departmentId : f.departmentId,
    }));
  }

  const canSubmit =
    form.code.trim() !== "" &&
    form.title.trim() !== "" &&
    form.programId !== "" &&
    form.departmentId !== "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        credits: Number(form.credits),
        semester: Number(form.semester),
        lectureHours: Number(form.lectureHours),
        programId: form.programId,
        departmentId: form.departmentId,
      };

      const res = await fetch(
        editing ? `/api/courses/${course!.id}` : "/api/courses",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error ?? "Could not save the course");
        setErrors(json.fields ?? {});
        return;
      }

      router.push(`/courses/${json.data.id}`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          {formError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="code" className="label">
            Course code
          </label>
          <input
            id="code"
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            className={`input font-mono ${errors.code ? "input-error" : ""}`}
            placeholder="CS301"
            required
          />
          {errors.code ? <p className="field-error">{errors.code}</p> : null}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="title" className="label">
            Title
          </label>
          <input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={`input ${errors.title ? "input-error" : ""}`}
            placeholder="Data Structures and Algorithms"
            required
          />
          {errors.title ? <p className="field-error">{errors.title}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="programId" className="label">
            Programme
          </label>
          <select
            id="programId"
            value={form.programId}
            onChange={(e) => pickProgram(e.target.value)}
            className={`input ${errors.programId ? "input-error" : ""}`}
            required
          >
            <option value="">Select...</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
          {errors.programId ? (
            <p className="field-error">{errors.programId}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="departmentId" className="label">
            Department
          </label>
          <select
            id="departmentId"
            value={form.departmentId}
            onChange={(e) => set("departmentId", e.target.value)}
            className={`input ${errors.departmentId ? "input-error" : ""}`}
            required
          >
            <option value="">Select...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>
          {errors.departmentId ? (
            <p className="field-error">{errors.departmentId}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="semester" className="label">
            Semester
          </label>
          <select
            id="semester"
            value={form.semester}
            onChange={(e) => set("semester", Number(e.target.value))}
            className="input"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="credits" className="label">
            Credits
          </label>
          <input
            id="credits"
            type="number"
            min={0}
            max={12}
            value={form.credits}
            onChange={(e) => set("credits", Number(e.target.value))}
            className={`input ${errors.credits ? "input-error" : ""}`}
          />
          {errors.credits ? (
            <p className="field-error">{errors.credits}</p>
          ) : (
            <p className="help">Weighted in the GPA calculation</p>
          )}
        </div>

        <div>
          <label htmlFor="lectureHours" className="label">
            Lecture hours / week
          </label>
          <input
            id="lectureHours"
            type="number"
            min={0}
            max={20}
            value={form.lectureHours}
            onChange={(e) => set("lectureHours", Number(e.target.value))}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-6">
        <button type="submit" disabled={busy || !canSubmit} className="btn-primary">
          {busy ? "Saving..." : editing ? "Save changes" : "Create course"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}