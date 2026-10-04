"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                  : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={[
                  "mt-0.5 h-5 w-5 shrink-0",
                  active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600",
                ].join(" ")}
              >
                <path d={item.icon} />
              </svg>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block truncate text-xs text-slate-500">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link href="/api-docs" className="btn-secondary btn-sm w-full">
          API reference
        </Link>
      </div>
    </>
  );
}

/** Horizontal nav for small screens, where the sidebar is hidden. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 lg:hidden">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}