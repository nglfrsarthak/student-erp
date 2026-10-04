/** Small presentation helpers shared across pages. */

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Marks are shown as "12 / 40". */
export function formatMark(value: number | null | undefined, max: number): string {
  if (value == null) return "-";
  return `${round(value, 1)} / ${max}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${round(value, 2)}%`;
}

export function round(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function initials(p: { firstName: string; lastName: string }): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}

/** Grade point + percentage -> short badge label. */
export function gradeLabel(
  letterGrade: string | null | undefined,
  gradePoints: number | null | undefined,
): string {
  if (!letterGrade) return "Not graded";
  return `${letterGrade} (${round(gradePoints ?? 0, 1)})`;
}