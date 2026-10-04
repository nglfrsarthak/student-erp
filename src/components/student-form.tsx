"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type FieldErrors = Record<string, string>;

type StudentRow = {
  id: string;
  enrollmentNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  gender: string | null;
  address: string | null;
  dateOfBirth: string | null;
  batchYear: number;
  currentSemester: number;
  status: string;
  programId: string;
};

type Program = { id: string; code: string; name: string };

const EMPTY: StudentRow = {
  id: "",
  enrollmentNo: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "",
  address: "",
  dateOfBirth: "",
  batchYear: new Date().getFullYear(),
  currentSemester: 1,
  status: "ACTIVE",
  programId: "",
};

/** Only yyyy-mm-dd is accepted by <input type="date">. */
function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function StudentForm({
  programs,
  student,
}: {
  programs: Program[];
  student?: StudentRow;
}) {
  const router = useRouter();
  const editing = Boolean(student?.id);

  const [form, setForm] = useState<StudentRow>(
    student ? { ...EMPTY, ...student, dateOfBirth: toDateInput(student.dateOfBirth) } : EMPTY,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof StudentRow>(key: K, value: StudentRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }

  const canSubmit = useMemo(
    () =>
      form.enrollmentNo.trim() !== "" &&
      form.firstName.trim() !== "" &&
      form.lastName.trim() !== "" &&
      form.email.trim() !== "" &&
      form.programId !== "",
    [form],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);

    try {
      const payload = {
        enrollmentNo: form.enrollmentNo.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone?.trim() || null,
        gender: form.gender?.trim() || null,
        address: form.address?.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
        batchYear: Number(form.batchYear),
        currentSemester: Number(form.currentSemester),
        programId: form.programId,
        status: form.status,
      };

      const res = await fetch(
        editing ? `/api/students/${student!.id}` : "/api/students",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error ?? "Could not save the student");
        setErrors(json.fields ?? json.details?.fieldErrors ?? {});
        return;
      }

      router.push(`/students/${json.data.id}`);
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

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Identity</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="enrollmentNo" className="label">
              Enrollment number
            </label>
            <input
              id="enrollmentNo"
              value={form.enrollmentNo}
              onChange={(e) => set("enrollmentNo", e.target.value)}
              className={`input font-mono ${errors.enrollmentNo ? "input-error" : ""}`}
              placeholder="CSE-2021-014"
              required
            />
            {errors.enrollmentNo ? (
              <p className="field-error">{errors.enrollmentNo}</p>
            ) : (
              <p className="help">Unique across the college</p>
            )}
          </div>

          <div>
            <label htmlFor="programId" className="label">
              Programme
            </label>
            <select
              id="programId"
              value={form.programId}
              onChange={(e) => set("programId", e.target.value)}
              className={`input ${errors.programId ? "input-error" : ""}`}
              required
            >
              <option value="">Select a programme...</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            {errors.programId ? <p className="field-error">{errors.programId}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="label">
              First name
            </label>
            <input
              id="firstName"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className={`input ${errors.firstName ? "input-error" : ""}`}
              required
            />
            {errors.firstName ? <p className="field-error">{errors.firstName}</p> : null}
          </div>

          <div>
            <label htmlFor="lastName" className="label">
              Last name
            </label>
            <input
              id="lastName"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className={`input ${errors.lastName ? "input-error" : ""}`}
              required
            />
            {errors.lastName ? <p className="field-error">{errors.lastName}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={`input ${errors.email ? "input-error" : ""}`}
              placeholder="student@college.edu"
              required
            />
            {errors.email ? <p className="field-error">{errors.email}</p> : null}
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Phone <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="phone"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              className="input"
              placeholder="+91 98765 43210"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="dateOfBirth" className="label">
              Date of birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth ?? ""}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              className={`input ${errors.dateOfBirth ? "input-error" : ""}`}
            />
            {errors.dateOfBirth ? (
              <p className="field-error">{errors.dateOfBirth}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="gender" className="label">
              Gender
            </label>
            <select
              id="gender"
              value={form.gender ?? ""}
              onChange={(e) => set("gender", e.target.value)}
              className="input"
            >
              <option value="">Prefer not to say</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="address" className="label">
              Address
            </label>
            <input
              id="address"
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              className="input"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-200 pt-6">
        <legend className="text-sm font-semibold text-slate-900">Academic</legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="batchYear" className="label">
              Batch year
            </label>
            <input
              id="batchYear"
              type="number"
              min={2000}
              max={2100}
              value={form.batchYear}
              onChange={(e) => set("batchYear", Number(e.target.value))}
              className={`input ${errors.batchYear ? "input-error" : ""}`}
              required
            />
            {errors.batchYear ? <p className="field-error">{errors.batchYear}</p> : null}
          </div>

          <div>
            <label htmlFor="currentSemester" className="label">
              Current semester
            </label>
            <select
              id="currentSemester"
              value={form.currentSemester}
              onChange={(e) => set("currentSemester", Number(e.target.value))}
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
            <label htmlFor="status" className="label">
              Status
            </label>
            <select
              id="status"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="input"
            >
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="GRADUATED">Graduated</option>
              <option value="DROPPED">Dropped</option>
            </select>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-6">
        <button type="submit" disabled={busy || !canSubmit} className="btn-primary">
          {busy ? "Saving..." : editing ? "Save changes" : "Create student"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}