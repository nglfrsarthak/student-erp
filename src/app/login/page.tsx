import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            SE
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Student ERP
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage students, courses and grades
          </p>
        </div>

        <div className="card p-6">
          <LoginForm />
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Demo accounts
          </p>
          <dl className="mt-2 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between gap-4">
              <dt className="font-mono">admin@college.edu</dt>
              <dd className="font-mono">Admin@123</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-mono">faculty@college.edu</dt>
              <dd className="font-mono">Faculty@123</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            Created by <code className="font-mono">npm run db:seed</code>.
          </p>
        </div>
      </div>
    </div>
  );
}