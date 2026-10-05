"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  MAX_FINAL_MARKS,
  MAX_INTERNAL_MARKS,
  gradeForPercentage,
  percentageFromMarks,
} from "@/lib/grading";

type Row = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  internalMarks: number | null;
  finalMarks: number | null;
  percentage: number | null;
  letterGrade: string | null;
  gradePoints: number | null;
  status: string;
};

// The grade scale lives in src/lib/grading.ts and is shared with the server.
// The grid previews with the *same* functions the API will use, so a letter
// grade can never differ between what the user sees and what gets stored.
const MAX_INTERNAL = MAX_INTERNAL_MARKS;
const MAX_FINAL = MAX_FINAL_MARKS;

function preview(internal: number | null, final: number | null) {
  const percentage = percentageFromMarks(internal, final);
  if (percentage == null) return null;
  const { letterGrade, gradePoints } = gradeForPercentage(percentage);
  return { percentage, letterGrade, gradePoints };
}

type Draft = { internalMarks: string; finalMarks: string };

export function GradesGrid({
  rows,
  credits,
  courseCode,
  semester,
  academicYear,
}: {
  rows: Row[];
  credits: number;
  courseCode: string;
  semester: number;
  academicYear: string;
}) {
  const router = useRouter();

  const initial = useMemo(() => {
    const d: Record<string, Draft> = {};
    for (const r of rows) {
      d[r.enrollmentId] = {
        internalMarks: r.internalMarks == null ? "" : String(r.internalMarks),
        finalMarks: r.finalMarks == null ? "" : String(r.finalMarks),
      };
    }
    return d;
  }, [rows]);

  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function update(id: string, key: keyof Draft, value: string) {
    // Keep it numeric-ish; empty is allowed (clears the mark).
    if (value !== "" && !/^\d{1,2}(\.\d?)?$/.test(value)) return;
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));
    setDirty(true);
    setMessage(null);
  }

  function toNumber(v: string): number | null {
    if (v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  async function save() {
    setBusy(true);
    setMessage(null);

    const entries = rows
      .map((r) => {
        const d = draft[r.enrollmentId];
        return {
          enrollmentId: r.enrollmentId,
          internalMarks: toNumber(d.internalMarks),
          finalMarks: toNumber(d.finalMarks),
        };
      })
      // Skip untouched blank rows so an empty sheet does not wipe grades.
      .filter((e) => e.internalMarks != null || e.finalMarks != null);

    if (entries.length === 0) {
      setMessage({ tone: "err", text: "Nothing to save - enter some marks first." });
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();

      if (!res.ok) {
        setMessage({ tone: "err", text: json.error ?? "Save failed" });
        return;
      }

      setDirty(false);
      setMessage({
        tone: "ok",
        text: `Saved ${json.data.updated} row(s). CGPA recalculated for ${json.data.studentsRecalculated} student(s).`,
      });
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    setDraft(initial);
    setDirty(false);
    setMessage(null);
  }

  /** Class average across the rows currently typed in. */
  const classAverage = useMemo(() => {
    const pcts = rows
      .map((r) => {
        const d = draft[r.enrollmentId];
        return preview(toNumber(d.internalMarks), toNumber(d.finalMarks))?.percentage;
      })
      .filter((p): p is number => p != null);
    if (pcts.length === 0) return null;
    return Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100) / 100;
  }, [rows, draft]);

  const totals = useMemo(() => {
    let points = 0;
    let gradedCredits = 0;
    for (const r of rows) {
      const d = draft[r.enrollmentId];
      const p = preview(toNumber(d.internalMarks), toNumber(d.finalMarks));
      if (p) {
        points += p.gradePoints * credits;
        gradedCredits += credits;
      }
    }
    return {
      gradedCredits,
      gpa: gradedCredits === 0 ? null : Math.round((points / gradedCredits) * 100) / 100,
    };
  }, [rows, draft, credits]);

  return (
    <div>
      {message ? (
        <div
          role="status"
          className={[
            "mb-4 rounded-lg border px-3 py-2.5 text-sm",
            message.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Enrollment no</th>
              <th>Student</th>
              <th className="w-28">
                Internal
                <span className="block font-normal normal-case text-slate-400">
                  / {MAX_INTERNAL}
                </span>
              </th>
              <th className="w-28">
                Final
                <span className="block font-normal normal-case text-slate-400">
                  / {MAX_FINAL}
                </span>
              </th>
              <th className="w-24">Total %</th>
              <th className="w-32">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = draft[r.enrollmentId] ?? { internalMarks: "", finalMarks: "" };
              const p = preview(toNumber(d.internalMarks), toNumber(d.finalMarks));
              const internalOver = toNumber(d.internalMarks) != null &&
                (toNumber(d.internalMarks) as number) > MAX_INTERNAL;
              const finalOver =
                toNumber(d.finalMarks) != null &&
                (toNumber(d.finalMarks) as number) > MAX_FINAL;

              return (
                <tr key={r.enrollmentId}>
                  <td className="font-mono text-xs whitespace-nowrap">
                    {r.enrollmentNo}
                  </td>
                  <td className="font-medium text-slate-900">{r.studentName}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={MAX_INTERNAL}
                      step="0.5"
                      value={d.internalMarks}
                      onChange={(e) =>
                        update(r.enrollmentId, "internalMarks", e.target.value)
                      }
                      className={`input px-2 py-1.5 ${internalOver ? "input-error" : ""}`}
                      aria-label={`Internal marks for ${r.studentName}`}
                    />
                    {internalOver ? (
                      <p className="field-error">Max {MAX_INTERNAL}</p>
                    ) : null}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={MAX_FINAL}
                      step="0.5"
                      value={d.finalMarks}
                      onChange={(e) =>
                        update(r.enrollmentId, "finalMarks", e.target.value)
                      }
                      className={`input px-2 py-1.5 ${finalOver ? "input-error" : ""}`}
                      aria-label={`Final marks for ${r.studentName}`}
                    />
                    {finalOver ? <p className="field-error">Max {MAX_FINAL}</p> : null}
                  </td>
                  <td>
                    {p ? (
                      <span
                        className={
                          p.percentage < 40
                            ? "font-semibold text-red-600"
                            : "font-medium text-slate-900"
                        }
                      >
                        {p.percentage}%
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td>
                    {p ? (
                      <span
                        className={[
                          "badge",
                          p.gradePoints >= 3.5
                            ? "bg-emerald-100 text-emerald-800"
                            : p.gradePoints >= 2.5
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-red-100 text-red-800",
                        ].join(" ")}
                      >
                        {p.letterGrade} ({p.gradePoints.toFixed(1)})
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {r.status === "DROPPED" ? "Dropped" : "Not graded"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-500">Class average: </span>
            <span className="font-semibold text-slate-900">
              {classAverage != null ? `${classAverage}%` : "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Course GPA: </span>
            <span className="font-semibold text-slate-900">
              {totals.gpa != null ? totals.gpa : "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Graded: </span>
            <span className="font-semibold text-slate-900">
              {totals.gradedCredits} credits
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dirty ? (
            <button
              type="button"
              onClick={discard}
              disabled={busy}
              className="btn-secondary"
            >
              Discard
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="btn-primary"
          >
            {busy ? "Saving..." : "Save marks"}
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Saving sets each graded row to COMPLETED and recalculates CGPA. Sheet:{" "}
        <span className="font-mono">
          {courseCode} / Sem {semester} / {academicYear}
        </span>
      </p>
    </div>
  );
}