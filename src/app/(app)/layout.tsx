import { requireSession } from "@/lib/auth";
import { MobileNav, SidebarNav } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  FACULTY: "Faculty",
  STUDENT: "Student",
};

function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const text = `${parts[0]?.charAt(0) ?? ""}${
    (parts[1] ?? "").charAt(0)
  }`.toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
      {text || "?"}
    </div>
  );
}

/**
 * Authenticated shell: sidebar + header + mobile nav.
 * Every page inside calls requireSession(), which redirects to /login when the
 * visitor has no valid session.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="hidden shrink-0 flex-col border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            SE
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              Student ERP
            </p>
            <p className="truncate text-xs text-slate-500">Campus management</p>
          </div>
        </div>

        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              SE
            </div>
            <span className="text-sm font-semibold">Student ERP</span>
          </div>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{session.name}</p>
              <p className="text-xs text-slate-500">
                {ROLE_LABEL[session.role] ?? session.role}
              </p>
            </div>
            <Avatar name={session.name} />
            <LogoutButton />
          </div>
        </header>

        <MobileNav />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}