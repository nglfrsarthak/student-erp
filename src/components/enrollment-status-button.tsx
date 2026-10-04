"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Enrollment = {
  id: string;
  status: string;
  percentage: number | null;
};

export function EnrollmentStatusButton({
  enrollment,
}: {
  enrollment: Enrollment;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/enrollments/${enrollment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Update failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const label =
    enrollment.status === "ENROLLED"
      ? "Mark completed"
      : enrollment.status === "COMPLETED"
        ? "Reopen"
        : "Re-enroll";

  const next =
    enrollment.status === "ENROLLED"
      ? "COMPLETED"
      : enrollment.status === "COMPLETED"
        ? "ENROLLED"
        : "ENROLLED";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setStatus(next)}
        disabled={busy}
        className="btn-secondary btn-sm whitespace-nowrap"
        title={
          enrollment.status === "COMPLETED"
            ? "Reopening will drop the recorded grade"
            : "Marks are still needed on the Grades page"
        }
      >
        {busy ? "..." : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}