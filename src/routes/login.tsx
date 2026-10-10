import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Citizen Login or Sign Up – ROAD-TRACK" },
      { name: "description", content: "Sign in to ROAD-TRACK to report and track road issues." },
      { property: "og:title", content: "Citizen Login – ROAD-TRACK" },
      { property: "og:description", content: "Sign in or create a citizen account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errors, setErrors] = useState<{ [k in "email" | "pw" | "pw2"]?: string }>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) {
      navigate({ to: "/" });
    }
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: { [k in "email" | "pw" | "pw2"]?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) er.email = "Enter a valid email address.";
    if (pw.length < 6) er.pw = "Password must be at least 6 characters.";
    if (mode === "signup" && pw !== pw2) er.pw2 = "Passwords do not match.";
    setErrors(er);
    setMsg(null);
    if (Object.keys(er).length) return;
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setBusy(false);
      if (error) return setMsg({ ok: false, text: error.message });
      navigate({ to: "/" });
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) return setMsg({ ok: false, text: error.message });
      if (data.session) return navigate({ to: "/" });
      setMsg({ ok: true, text: `Check ${email} for a confirmation link, then log in.` });
    }
  };

  if (session) {
    return null;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-primary">{mode === "login" ? "Citizen Login" : "Create citizen account"}</h1>
        <div className="mt-4 grid grid-cols-2 rounded bg-muted p-1 text-sm">
          {(["login", "signup"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setMsg(null); setErrors({}); }} className={`rounded py-1.5 font-medium ${mode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
              {m === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="Email" error={errors.email}><input type="email" autoComplete="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" error={errors.pw}><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="input-field" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          {mode === "signup" && <Field label="Confirm password" error={errors.pw2}><input type="password" autoComplete="new-password" className="input-field" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>}
          <button disabled={busy} className="btn-primary w-full">{busy ? "Please wait…" : mode === "login" ? "Login" : "Sign Up"}</button>
          {msg && <p className={`rounded p-3 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
