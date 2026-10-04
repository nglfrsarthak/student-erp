/**
 * Seed script: demo academic structure, users, students, courses and results.
 *
 *   npm run db:seed
 *
 * Idempotent - safe to run repeatedly. Everything is keyed on natural unique
 * columns (course code, enrollment number, email) with upserts.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  gradeForPercentage,
  MAX_FINAL_MARKS,
  MAX_INTERNAL_MARKS,
  percentageFromMarks,
} from "../src/lib/grading";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ---------------------------------------------------------------------------
// Demo content
// ---------------------------------------------------------------------------

const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science & Engineering", hodName: "Dr. R. Iyer" },
  { code: "ECE", name: "Electronics & Communication", hodName: "Dr. M. Rao" },
  { code: "MEC", name: "Mechanical Engineering", hodName: "Dr. S. Nair" },
];

const PROGRAMS = [
  { code: "BTCS", name: "B.Tech Computer Science", degree: "B.Tech", durationYears: 4, totalCredits: 120, dept: "CSE" },
  { code: "BTEC", name: "B.Tech Electronics", degree: "B.Tech", durationYears: 4, totalCredits: 120, dept: "ECE" },
  { code: "BTME", name: "B.Tech Mechanical", degree: "B.Tech", durationYears: 4, totalCredits: 120, dept: "MEC" },
];

const COURSES = [
  // Semester 1 (common)
  { code: "MA101", title: "Engineering Mathematics I", credits: 4, semester: 1, hours: 4, program: "BTCS", dept: "CSE" },
  { code: "PH101", title: "Engineering Physics", credits: 3, semester: 1, hours: 3, program: "BTCS", dept: "CSE" },
  { code: "CS101", title: "Programming Fundamentals", credits: 4, semester: 1, hours: 4, program: "BTCS", dept: "CSE" },

  // Semester 3 (core CS)
  { code: "CS301", title: "Data Structures and Algorithms", credits: 4, semester: 3, hours: 4, program: "BTCS", dept: "CSE" },
  { code: "CS302", title: "Object Oriented Programming", credits: 3, semester: 3, hours: 3, program: "BTCS", dept: "CSE" },
  { code: "MA301", title: "Engineering Mathematics III", credits: 4, semester: 3, hours: 4, program: "BTCS", dept: "CSE" },
  { code: "CS303", title: "Digital Logic Design", credits: 3, semester: 3, hours: 3, program: "BTCS", dept: "CSE" },

  // Semester 5
  { code: "CS501", title: "Database Management Systems", credits: 4, semester: 5, hours: 4, program: "BTCS", dept: "CSE" },
  { code: "CS502", title: "Operating Systems", credits: 4, semester: 5, hours: 4, program: "BTCS", dept: "CSE" },
  { code: "CS503", title: "Computer Networks", credits: 3, semester: 5, hours: 3, program: "BTCS", dept: "CSE" },
  { code: "CS504", title: "Software Engineering", credits: 3, semester: 5, hours: 3, program: "BTCS", dept: "CSE" },

  // Semester 7
  { code: "CS701", title: "Machine Learning", credits: 4, semester: 7, hours: 4, program: "BTCS", dept: "CSE" },
  { code: "CS702", title: "Cloud Computing", credits: 3, semester: 7, hours: 3, program: "BTCS", dept: "CSE" },

  // A couple of ECE courses so the other programmes are not empty.
  { code: "EC201", title: "Analog Circuits", credits: 4, semester: 3, hours: 4, program: "BTEC", dept: "ECE" },
  { code: "EC301", title: "Signals and Systems", credits: 4, semester: 5, hours: 4, program: "BTEC", dept: "ECE" },
  { code: "ME201", title: "Thermodynamics", credits: 4, semester: 3, hours: 4, program: "BTME", dept: "MEC" },
  { code: "ME301", title: "Fluid Mechanics", credits: 4, semester: 5, hours: 4, program: "BTME", dept: "MEC" },
];

const FIRST_NAMES = [
  "Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Ishita", "Kabir", "Meera",
  "Rohan", "Saanvi", "Aditya", "Nisha", "Karan", "Priya", "Devansh", "Tara",
  "Yash", "Riya", "Nikhil", "Aisha", "Varun", "Sneha", "Manav", "Pooja",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Nair", "Patel", "Reddy", "Menon", "Kulkarni",
  "Banerjee", "Chopra", "Desai", "Gupta", "Joshi", "Kapoor", "Malhotra",
  "Rao", "Singh", "Trivedi",
];

/** Deterministic PRNG so re-seeding produces the same demo data. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    // mulberry32
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260804);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/** Marks clustered around a target percentage with realistic spread. */
function marksFor(targetPercent: number) {
  const internal = Math.min(
    MAX_INTERNAL_MARKS,
    Math.max(0, Math.round((targetPercent / 100) * MAX_INTERNAL_MARKS + randomInt(-4, 4))),
  );
  const final = Math.min(
    MAX_FINAL_MARKS,
    Math.max(
      0,
      Math.round(
        (targetPercent / 100) * MAX_FINAL_MARKS +
          randomInt(-6, 6) -
          (internal - (targetPercent / 100) * MAX_INTERNAL_MARKS),
      ),
    ),
  );
  return { internal, final };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Student ERP...\n");

  // 1. Users -----------------------------------------------------------------
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@college.edu").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const facultyHash = await bcrypt.hash("Faculty@123", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "System Administrator", passwordHash: adminHash, role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "System Administrator",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "faculty@college.edu" },
    update: { name: "Dr. R. Iyer", passwordHash: facultyHash, role: "FACULTY" },
    create: {
      email: "faculty@college.edu",
      name: "Dr. R. Iyer",
      passwordHash: facultyHash,
      role: "FACULTY",
    },
  });

  console.log(`  users       -> admin (${adminEmail}) + faculty`);

  // 2. Departments ----------------------------------------------------------
  const deptByCode = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, hodName: d.hodName },
      create: d,
    });
    deptByCode.set(d.code, row.id);
  }
  console.log(`  departments -> ${DEPARTMENTS.length}`);

  // 3. Programmes -----------------------------------------------------------
  const programByCode = new Map<string, string>();
  for (const p of PROGRAMS) {
    const departmentId = deptByCode.get(p.dept)!;
    const { dept: _dept, ...data } = p;
    const row = await prisma.program.upsert({
      where: { code: p.code },
      update: { ...data, departmentId },
      create: { ...data, departmentId },
    });
    programByCode.set(p.code, row.id);
  }
  console.log(`  programmes  -> ${PROGRAMS.length}`);

  // 4. Courses --------------------------------------------------------------
  const courseByCode = new Map<string, { id: string; credits: number; semester: number }>();
  for (const c of COURSES) {
    const programId = programByCode.get(c.program)!;
    const departmentId = deptByCode.get(c.dept)!;
    const { program: _p, dept: _d, ...data } = c;
    const row = await prisma.course.upsert({
      where: { code: c.code },
      update: { ...data, programId, departmentId },
      create: { ...data, programId, departmentId },
    });
    courseByCode.set(c.code, { id: row.id, credits: row.credits, semester: row.semester });
  }
  console.log(`  courses     -> ${COURSES.length}`);

  // 5. Students -------------------------------------------------------------
  const csProgramId = programByCode.get("BTCS")!;
  const studentIds: string[] = [];

  const existingStudents = await prisma.student.count();
  if (existingStudents >= 24) {
    console.log(`  students    -> ${existingStudents} already present, skipping`);
  } else {
    for (let i = 0; i < 24; i++) {
      const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lastName = LAST_NAMES[i % LAST_NAMES.length];
      const batchYear = 2021 + (i % 4);
      const enrollmentNo = `CSE-${batchYear}-${String(i + 1).padStart(3, "0")}`;
      const currentSemester = Math.min(8, 8 - ((2026 - batchYear) * 2));

      const student = await prisma.student.upsert({
        where: { enrollmentNo },
        update: {},
        create: {
          enrollmentNo,
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@college.edu`,
          phone: `+91 ${randomInt(70, 99)}${randomInt(10000000, 99999999)}`,
          dateOfBirth: new Date(batchYear - 18, randomInt(0, 11), randomInt(1, 28)),
          gender: i % 3 === 0 ? "Female" : "Male",
          address: `${randomInt(1, 200)}, ${pick(["MG Road", "Park Street", "Lake View Lane", "Station Road"])}`,
          batchYear,
          currentSemester: Math.max(1, currentSemester),
          programId: csProgramId,
          status: i % 17 === 0 ? "SUSPENDED" : "ACTIVE",
        },
      });
      studentIds.push(student.id);

      // Portal login for the first three students. The link lives on Student
      // (Student.userId), so create the user first, then point the student at it.
      if (i < 3) {
        const hash = await bcrypt.hash("Student@123", 10);
        const user = await prisma.user.upsert({
          where: { email: student.email },
          update: {},
          create: {
            email: student.email,
            name: `${firstName} ${lastName}`,
            passwordHash: hash,
            role: "STUDENT",
          },
        });
        await prisma.student.update({
          where: { id: student.id },
          data: { userId: user.id },
        });
      }
    }
    console.log(`  students    -> 24 (3 with portal logins, password Student@123)`);
  }

  // Ensure we have ids even when students already existed.
  if (studentIds.length === 0) {
    const rows = await prisma.student.findMany({
      where: { programId: csProgramId },
      orderBy: { enrollmentNo: "asc" },
      select: { id: true },
    });
    studentIds.push(...rows.map((r) => r.id));
  }

  // 6. Enrollments + results ------------------------------------------------
  const terms = [
    { semester: 1, academicYear: "2021-08" },
    { semester: 3, academicYear: "2022-08" },
    { semester: 5, academicYear: "2023-08" },
    { semester: 7, academicYear: "2024-08" },
  ];

  const csCourses = COURSES.filter((c) => c.program === "BTCS");
  let created = 0;
  let graded = 0;

  for (const [index, studentId] of studentIds.entries()) {
    // Ability tier drives results so the leaderboard looks believable.
    const ability = 45 + ((index * 37) % 50); // 45 - 94

    for (const term of terms) {
      const courses = csCourses.filter((c) => c.semester === term.semester);
      if (courses.length === 0) continue;

      for (const c of courses) {
        const info = courseByCode.get(c.code)!;
        const target = Math.min(98, Math.max(28, ability + randomInt(-9, 9)));
        const { internal, final } = marksFor(target);
        const percentage = percentageFromMarks(internal, final)!;
        const { letterGrade, gradePoints } = gradeForPercentage(percentage);

        // Older terms are fully graded; the newest is still in progress.
        const isComplete = term.semester < 7;

        await prisma.enrollment.upsert({
          where: {
            studentId_courseId_semester: {
              studentId,
              courseId: info.id,
              semester: term.semester,
            },
          },
          update: {},
          create: {
            studentId,
            courseId: info.id,
            semester: term.semester,
            academicYear: term.academicYear,
            status: isComplete ? "COMPLETED" : "ENROLLED",
            ...(isComplete
              ? { internalMarks: internal, finalMarks: final, percentage, letterGrade, gradePoints }
              : {}),
          },
        });
        created++;
        if (isComplete) graded++;
      }
    }
  }
  console.log(`  enrollments -> ${created} (${graded} graded, rest awaiting results)`);

  // 7. Recompute CGPA -------------------------------------------------------
  const calculateGpa = (grades: { gradePoints: number | null; credits: number }[]) => {
    let credits = 0;
    let points = 0;
    for (const g of grades) {
      if (g.gradePoints == null) continue;
      credits += g.credits;
      points += g.gradePoints * g.credits;
    }
    return credits === 0 ? 0 : Math.round((points / credits) * 100) / 100;
  };

  for (const studentId of studentIds) {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: "COMPLETED" },
      select: { gradePoints: true, course: { select: { credits: true } } },
    });
    const cgpa = calculateGpa(
      enrollments.map((e) => ({ gradePoints: e.gradePoints, credits: e.course.credits })),
    );
    await prisma.student.update({ where: { id: studentId }, data: { cgpa } });
  }

  const [studentCount, courseCount, enrollmentCount] = await Promise.all([
    prisma.student.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
  ]);

  console.log(`  cgpa        -> recalculated for ${studentIds.length} students`);
  console.log("\nDone. Sign in with:");
  console.log(`  ${adminEmail} / ${adminPassword}      (ADMIN)`);
  console.log("  faculty@college.edu / Faculty@123  (FACULTY)");
  console.log("\nTotals:");
  console.log(`  students=${studentCount} courses=${courseCount} enrollments=${enrollmentCount}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("\nSeed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });