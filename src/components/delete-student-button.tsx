"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteStudentButton({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="btn-danger"
      >
        Delete
      </button>
    );
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Delete failed");
        setBusy(false);
        return;
      }
      router.push("/students");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="btn-danger"
        >
          {busy ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}