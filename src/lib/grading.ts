/**
 * Grading rules for the ERP.
 *
 * A single source of truth shared by the seed script, the grade-entry UI and
 * the API routes, so a letter grade can never disagree between screens.
 */

export const MAX_INTERNAL_MARKS = 40;
export const MAX_FINAL_MARKS = 60;
export const MAX_TOTAL_MARKS = MAX_INTERNAL_MARKS + MAX_FINAL_MARKS; // 100

/** Passing mark in percent. Below this the course is a backlog. */
export const PASS_PERCENTAGE = 40;

export type GradeBand = {
  minPercentage: number;
  letterGrade: string;
  gradePoints: number;
};

/** Ordered high -> low. The first band whose `minPercentage` is met wins. */
export const GRADE_SCALE: GradeBand[] = [
  { minPercentage: 90, letterGrade: "A+", gradePoints: 4.0 },
  { minPercentage: 85, letterGrade: "A", gradePoints: 4.0 },
  { minPercentage: 80, letterGrade: "B+", gradePoints: 3.5 },
  { minPercentage: 75, letterGrade: "B", gradePoints: 3.0 },
  { minPercentage: 70, letterGrade: "C", gradePoints: 2.5 },
  { minPercentage: 65, letterGrade: "C-", gradePoints: 2.0 },
  { minPercentage: 60, letterGrade: "D", gradePoints: 1.0 },
  { minPercentage: 0, letterGrade: "F", gradePoints: 0.0 },
];

/** Map a percentage (0-100) to its letter grade and grade points. */
export function gradeForPercentage(percentage: number): {
  letterGrade: string;
  gradePoints: number;
} {
  const band = GRADE_SCALE.find((b) => percentage >= b.minPercentage);
  const fallback = GRADE_SCALE[GRADE_SCALE.length - 1];
  return {
    letterGrade: band?.letterGrade ?? fallback.letterGrade,
    gradePoints: band?.gradePoints ?? fallback.gradePoints,
  };
}

/**
 * Combine internal (out of 40) and final (out of 60) marks into a percentage.
 * Returns null when either mark is missing, since an ungraded enrollment has
 * no percentage.
 */
export function percentageFromMarks(
  internalMarks: number | null | undefined,
  finalMarks: number | null | undefined,
): number | null {
  if (internalMarks == null || finalMarks == null) return null;
  const total = internalMarks + finalMarks;
  return Math.round((total / MAX_TOTAL_MARKS) * 100 * 100) / 100;
}

export function isBacklog(percentage: number | null | undefined): boolean {
  return percentage != null && percentage < PASS_PERCENTAGE;
}

export type WeightedGrade = {
  gradePoints: number | null;
  credits: number;
};

/**
 * Credit-weighted GPA.
 *
 * Only enrollments that carry a gradePoints value are counted, so in-progress
 * courses do not drag the average down. Returns 0 when nothing is graded yet.
 */
export function calculateGpa(grades: WeightedGrade[]): number {
  let creditsEarned = 0;
  let points = 0;

  for (const g of grades) {
    if (g.gradePoints == null) continue;
    creditsEarned += g.credits;
    points += g.gradePoints * g.credits;
  }

  if (creditsEarned === 0) return 0;
  return Math.round((points / creditsEarned) * 100) / 100;
}

/** Classification band shown on transcripts. */
export function classifyCgpa(cgpa: number): string {
  if (cgpa >= 3.75) return "Distinction";
  if (cgpa >= 3.5) return "Merit";
  if (cgpa >= 2.5) return "Pass";
  if (cgpa > 0) return "Re-appear";
  return "Not graded";
}