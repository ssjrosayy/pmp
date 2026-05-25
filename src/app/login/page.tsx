"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@axis.local");
  const [password, setPassword] = useState("Axis@12345");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Unable to sign in." }));
      setError(data.error ?? "Unable to sign in.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function forgotPassword() {
    setMessage("");
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setMessage("Password reset workflow recorded.");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-20">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-base font-bold text-white">
                AX
              </div>
              <div>
                <p className="text-lg font-semibold">Axis Ops</p>
                <p className="text-sm text-slate-500">Internal operations platform</p>
              </div>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Sign in to Axis</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Manage projects, teams, HR, procurement, documents, meetings, and approvals from one secure workspace.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <span className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    className="w-full outline-none"
                    autoComplete="email"
                    required
                  />
                </span>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <span className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="w-full outline-none"
                    autoComplete="current-password"
                    required
                  />
                </span>
              </label>

              {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
              {message ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
              <button
                type="button"
                onClick={forgotPassword}
                className="text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                Forgot password
              </button>
            </form>
          </div>
        </section>
        <section className="hidden bg-blue-950 lg:block">
          <div className="flex h-full flex-col justify-between p-12 text-white">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-200">Axis command layer</p>
              <h2 className="mt-6 text-5xl font-semibold leading-tight">
                Operational clarity for every department, project, and decision.
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {["RBAC", "Audit Logs", "Finance Controls", "Project Boards"].map((item) => (
                <div key={item} className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold">{item}</p>
                  <p className="mt-2 text-xs leading-5 text-blue-100">Built into the first version.</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
