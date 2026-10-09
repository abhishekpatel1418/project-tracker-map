import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DemoBadge } from "@/components/badges";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login or Sign Up – ROAD-TRACK" },
      { name: "description", content: "Sign in to ROAD-TRACK to report and track road issues." },
      { property: "og:title", content: "Login – ROAD-TRACK" },
      { property: "og:description", content: "Sign in or create a citizen account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errors, setErrors] = useState<{ [k in "email" | "pw" | "pw2"]?: string }>({});
  const [done, setDone] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: { [k in "email" | "pw" | "pw2"]?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) er.email = "Enter a valid email address.";
    if (pw.length < 6) er.pw = "Password must be at least 6 characters.";
    if (mode === "signup" && pw !== pw2) er.pw2 = "Passwords do not match.";
    setErrors(er);
    if (Object.keys(er).length === 0)
      setDone(mode === "login" ? `Signed in as ${email} (prototype — no real account yet).` : `Account created for ${email} (prototype — not saved yet).`);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border bg-card p-8 shadow-sm">
        <DemoBadge />
        <h1 className="mt-4 text-2xl font-bold text-primary">{mode === "login" ? "Citizen Login" : "Create citizen account"}</h1>
        <div className="mt-4 grid grid-cols-2 rounded bg-muted p-1 text-sm">
          {(["login", "signup"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setDone(""); setErrors({}); }} className={`rounded py-1.5 font-medium ${mode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
              {m === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="Email" error={errors.email}><input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" error={errors.pw}><input type="password" className="input-field" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          {mode === "signup" && <Field label="Confirm password" error={errors.pw2}><input type="password" className="input-field" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>}
          <button className="btn-primary w-full">{mode === "login" ? "Login" : "Sign Up"}</button>
          {done && <p className="rounded bg-success/10 p-3 text-sm text-success">{done}</p>}
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
