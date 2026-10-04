"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FieldErrors = Record<string, string>;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error ?? "Sign in failed");
        setErrors(json.fields ?? {});
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Is it running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          {formError}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`input ${errors.email ? "input-error" : ""}`}
          placeholder="admin@college.edu"
        />
        {errors.email ? <p className="field-error">{errors.email}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`input ${errors.password ? "input-error" : ""}`}
          placeholder="••••••••"
        />
        {errors.password ? <p className="field-error">{errors.password}</p> : null}
      </div>

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}