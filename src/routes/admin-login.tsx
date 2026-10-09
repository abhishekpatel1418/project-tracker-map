import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DemoBadge } from "@/components/badges";

// Admin roles prepared for later backend-enforced permissions.
export const ADMIN_ROLES = [
  { value: "central", label: "Central Admin" },
  { value: "pwd", label: "State PWD Officer" },
  { value: "nhai", label: "NHAI Officer" },
  { value: "pmgsy", label: "PMGSY Officer" },
] as const;

export const Route = createFileRoute("/admin-login")({
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
  const [role, setRole] = useState<string>("central");
  const [userId, setUserId] = useState("");
  const [pw, setPw] = useState("");
  const [errors, setErrors] = useState<{ userId?: string; pw?: string }>({});
  const [done, setDone] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: { userId?: string; pw?: string } = {};
    if (userId.trim().length < 3) er.userId = "Enter your official User ID.";
    if (pw.length < 6) er.pw = "Password must be at least 6 characters.";
    setErrors(er);
    if (Object.keys(er).length === 0) {
      const label = ADMIN_ROLES.find((r) => r.value === role)?.label;
      setDone(`Prototype only: credentials are not verified yet. Continue as ${label}.`);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border border-t-4 border-t-primary bg-card p-8 shadow-sm">
        <DemoBadge />
        <h1 className="mt-4 text-2xl font-bold text-primary">Admin Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">For authorised officials only. Accounts are issued by the Central Admin — there is no public registration.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Role</span>
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
              {ADMIN_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">User ID</span>
            <input className="input-field" autoComplete="username" value={userId} onChange={(e) => setUserId(e.target.value)} />
            {errors.userId && <span className="mt-1 block text-xs text-destructive">{errors.userId}</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Password</span>
            <input type="password" className="input-field" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            {errors.pw && <span className="mt-1 block text-xs text-destructive">{errors.pw}</span>}
          </label>
          <button className="btn-primary w-full">Sign in to Admin Portal</button>
          {done && (
            <div className="rounded bg-warning/10 p-3 text-sm">
              <p>{done}</p>
              <Link to="/admin" className="mt-2 inline-block font-semibold text-primary hover:underline">Open Admin Dashboard →</Link>
            </div>
          )}
        </form>
        <p className="mt-6 text-xs text-muted-foreground">Security note: this is a prototype. Login and department permissions are not enforced until a real backend is connected.</p>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Citizen? <Link to="/login" className="text-primary hover:underline">Use citizen login</Link></p>
    </div>
  );
}
