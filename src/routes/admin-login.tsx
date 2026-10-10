import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRoles } from "@/lib/auth";

type Search = { denied?: number };

export const Route = createFileRoute("/admin-login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => (s["denied"] ? { denied: 1 } : {}),
  beforeLoad: async ({ search }) => {
    if (!search?.denied) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const roles = await fetchMyRoles();
        if (roles.length > 0) {
          throw redirect({ to: "/admin" });
        }
      }
    }
  },
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

export function AdminLoginPage({ testSearch }: { testSearch?: Search } = {}) {
  const navigate = useNavigate();
  let search: Search = {};
  try {
    search = testSearch ?? Route.useSearch();
  } catch {
    search = testSearch ?? {};
  }
  const denied = search.denied;
  const [mode, setMode] = useState<"login" | "activate">("login");
  const [userId, setUserId] = useState("");
  const [pw, setPw] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [err, setErr] = useState(
    denied ? "Access Denied: This account does not have Admin Portal access." : ""
  );
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setSuccessMsg("");
    if (!userId.includes("@")) return setErr("Enter your official User ID (email address).");
    if (pw.length < 6) return setErr("Password must be at least 6 characters.");

    if (mode === "activate") {
      const codeClean = activationCode.trim();
      if (codeClean.length < 10) {
        return setErr("Enter a valid One-Time Admin Activation Code (e.g. RT-INV-YYMMDD-XXXXXXXX).");
      }
      setBusy(true);

      // Authenticate official session first
      let authRes = await supabase.auth.signInWithPassword({ email: userId.trim(), password: pw });
      if (authRes.error && authRes.error.message.toLowerCase().includes("invalid login credentials")) {
        // Try sign-up if this is a newly assigned official without a prior password account
        const signupRes = await supabase.auth.signUp({ email: userId.trim(), password: pw });
        if (signupRes.error) {
          setBusy(false);
          return setErr(`Authentication setup failed: ${signupRes.error.message}`);
        }
        if (!signupRes.data.session) {
          authRes = await supabase.auth.signInWithPassword({ email: userId.trim(), password: pw });
        } else {
          authRes = signupRes as any;
        }
      }

      if (authRes.error && !authRes.data?.session) {
        setBusy(false);
        return setErr(`Authentication failed: ${authRes.error.message}`);
      }

      // Call secure activation RPC
      try {
        const { data, error } = await supabase.rpc("activate_admin_invitation", {
          p_invitation_code: codeClean,
        });

        setBusy(false);
        if (error) {
          if (error.code === "PGRST202" || error.code === "42883" || error.message?.includes("function")) {
            return setErr("Database activation RPC is pending SQL migration in Supabase (20261011002000_admin_invitations_and_activation.sql). Please execute the migration in Supabase SQL Editor.");
          }
          return setErr(`Activation failed: ${error.message}`);
        }

        const rpcPayload = data as any;
        if (!rpcPayload?.success) {
          return setErr(rpcPayload?.message || rpcPayload?.error || "Activation code is invalid, expired, or already claimed.");
        }

        setSuccessMsg(`Officer account activated successfully! Assigned role: ${rpcPayload.role}. Navigating to dashboard…`);
        setTimeout(() => navigate({ to: "/admin" }), 1000);
        return;
      } catch (rpcErr: any) {
        setBusy(false);
        return setErr(`Activation request failed: ${rpcErr?.message || "Server error"}.`);
      }
    }

    // Standard Sign-In Mode
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: userId.trim(), password: pw });
    if (error) {
      setBusy(false);
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return setErr("Official email address is not confirmed. Please verify your email before signing in.");
      }
      return setErr("Invalid User ID or password.");
    }
    const roles = await fetchMyRoles();
    setBusy(false);
    if (roles.length === 0) {
      await supabase.auth.signOut();
      return setErr("Access Denied: This account is not assigned an administrative role in public.user_roles.");
    }
    navigate({ to: "/admin" });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border border-t-4 border-t-primary bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-primary">Admin Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For authorised officials only. Accounts and roles are assigned by the Central Admin — there is no public registration.
        </p>
        <div className="mt-4 grid grid-cols-2 rounded bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => { setMode("login"); setErr(""); setSuccessMsg(""); }}
            className={`rounded py-1.5 font-medium transition-colors ${
              mode === "login" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Official Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("activate"); setErr(""); setSuccessMsg(""); }}
            className={`rounded py-1.5 font-medium transition-colors ${
              mode === "activate" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Activate Account
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Official User ID (email)</span>
            <input
              className="input-field"
              autoComplete="username"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="officer@department.gov.in"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Password</span>
            <input
              type="password"
              className="input-field"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </label>

          {mode === "activate" && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">One-Time Activation Code</span>
              <input
                className="input-field font-mono uppercase"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="RT-INV-YYMMDD-XXXXXXXX"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Enter the unique code issued to your official email by Central Administration.
              </span>
            </label>
          )}

          <button disabled={busy} className="btn-primary w-full">
            {busy ? "Authenticating…" : mode === "login" ? "Sign in to Admin Portal" : "Redeem Code & Activate Role"}
          </button>

          {successMsg && (
            <div className="rounded border border-success/30 bg-success/10 p-3 text-sm text-success">
              {successMsg}
            </div>
          )}

          {err && (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-semibold">{err}</p>
              {err.includes("Access Denied") && (
                <p className="mt-1 text-xs text-destructive/90 leading-relaxed">
                  Only accounts with authorized roles in <code className="font-mono bg-destructive/20 px-1 py-0.5 rounded">public.user_roles</code> (Central Admin, State PWD, NHAI, or PMGSY Officer) are permitted.
                </p>
              )}
            </div>
          )}
        </form>

        {/* Hackathon Mentor Presentation Demo Callout */}
        <div className="mt-6 rounded-lg border-2 border-dashed border-accent/60 bg-accent/5 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-accent uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Hackathon & Mentor Review Mode</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Inspect the complete officer dashboard, cross-department jurisdiction queues, and grievance review workflows with safe mock data. No credentials or live database required.
          </p>
          <Link
            to="/admin"
            search={{ demo: 1 }}
            className="btn-accent mt-3 inline-flex w-full items-center justify-center gap-2 !py-2.5 text-xs font-semibold shadow-sm"
          >
            <ShieldCheck className="h-4 w-4" />
            Try Demo Admin
          </Link>
        </div>

        <div className="mt-6 rounded border bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Official Security Architecture:</strong> Administrative roles (Central Admin, PWD, NHAI, or PMGSY officer) are read securely from the server after sign-in. To configure an admin account, assign the role directly in the <code className="font-mono text-[11px]">public.user_roles</code> database table. There is no public self-registration.
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Citizen? <Link to="/login" className="text-primary hover:underline">Use citizen login</Link>
      </p>
    </div>
  );
}
