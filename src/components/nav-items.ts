export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Overview and reports",
    icon: "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10",
  },
  {
    href: "/students",
    label: "Students",
    description: "Records and profiles",
    icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-6 0 3 3 0 016 0zM19 8a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    href: "/courses",
    label: "Courses",
    description: "Curriculum catalogue",
    icon: "M12 6.03A8.97 8.97 0 0024 4.5v15a8.97 8.97 0 01-12-1.53A8.97 8.97 0 003 19.5v-15a8.97 8.97 0 0112 1.53z",
  },
  {
    href: "/enrollments",
    label: "Enrollments",
    description: "Register and drop students",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    href: "/grades",
    label: "Grades",
    description: "Marks and GPA",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
];

/** Active-state helper so the sidebar highlights the current route. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}