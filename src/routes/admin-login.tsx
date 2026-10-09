import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRoles } from "@/lib/auth";

type Search = { denied?: number };

export const Route = createFileRoute("/admin-login")({
  validateSearch: (s: Record<string, unknown>): Search => (s.denied ? { denied: 1 } : {}),
  head: () => ({
    meta: [
      { title: "Admin Portal Login – ROAD-TRACK" },
      { name: "description", content: "Restricted sign-in for ROAD-TRACK central admins and department officers." },
      { property: "og:title", content: "Admin Portal Login – ROAD-TRACK" },
      { property: "og:description", content: "Restricted sign-in for authorised officials." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { denied } = Route.useSearch();
  const [userId, setUserId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(denied ? "This account does not have Admin Portal access." : "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!userId.includes("@")) return setErr("Enter your official User ID (email address).");
    if (pw.length < 6) return setErr("Password must be at least 6 characters.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: userId.trim(), password: pw });
    if (error) { setBusy(false); return setErr("Invalid User ID or password."); }
    const roles = await fetchMyRoles();
    setBusy(false);
    if (roles.length === 0) {
      await supabase.auth.signOut();
      return setErr("This account does not have Admin Portal access.");
    }
    navigate({ to: "/admin" });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border border-t-4 border-t-primary bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-primary">Admin Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">For authorised officials only. Accounts and roles are assigned by the Central Admin — there is no public registration.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">User ID (official email)</span>
            <input className="input-field" autoComplete="username" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Password</span>
            <input type="password" className="input-field" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <button disabled={busy} className="btn-primary w-full">{busy ? "Checking…" : "Sign in to Admin Portal"}</button>
          {err && <p className="rounded bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
        </form>
        <p className="mt-6 text-xs text-muted-foreground">Your role (Central Admin, PWD, NHAI or PMGSY officer) is read from the server after sign-in — it cannot be chosen here.</p>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Citizen? <Link to="/login" className="text-primary hover:underline">Use citizen login</Link></p>
    </div>
  );
}
