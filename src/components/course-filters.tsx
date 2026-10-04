"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Program = { id: string; code: string; name: string };

export function CourseFilters({
  programs,
  current,
}: {
  programs: Program[];
  current: { search: string; programId: string; semester: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(current.search);

  function apply(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries({ ...current, ...overrides })) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `/courses?${qs}` : "/courses");
  }

  return (
    <form
      className="card flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ search });
      }}
    >
      <div className="min-w-[220px] flex-1">
        <label htmlFor="search" className="label">
          Search
        </label>
        <input
          id="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          placeholder="Course code or title"
        />
      </div>

      <div className="min-w-[180px]">
        <label htmlFor="programId" className="label">
          Programme
        </label>
        <select
          id="programId"
          value={current.programId}
          onChange={(e) => apply({ programId: e.target.value })}
          className="input"
        >
          <option value="">All programmes</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
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
          onChange={(e) => apply({ semester: e.target.value })}
          className="input"
        >
          <option value="">All</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <option key={s} value={s}>
              Sem {s}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn-primary">
        Search
      </button>
      <button
        type="button"
        onClick={() => {
          setSearch("");
          router.push("/courses");
        }}
        className="btn-secondary"
      >
        Reset
      </button>
    </form>
  );
}