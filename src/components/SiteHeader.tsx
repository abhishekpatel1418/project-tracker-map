import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Explore Projects" },
  { to: "/report", label: "Report Issue" },
  { to: "/track", label: "Track Complaint" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded bg-primary">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M8 22 11 2M16 22 13 2" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 6v2M12 11v2M12 16v2" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight text-primary">ROAD-TRACK</span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const link = "rounded px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary";
  const active = { className: "rounded px-3 py-2 text-sm font-semibold text-primary bg-secondary" };
  return (
    <header className="sticky top-0 z-[1000] border-b bg-card/95 backdrop-blur">
      <div className="h-1 bg-accent" />
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={link} activeProps={active} activeOptions={{ exact: n.to === "/" }}>{n.label}</Link>
          ))}
          {session ? (
            <button className="btn-outline ml-2 !py-1.5" onClick={() => supabase.auth.signOut()} title={session.user.email}>Log out</button>
          ) : (
            <Link to="/login" className="btn-primary ml-2 !py-1.5">Login</Link>
          )}
        </nav>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <nav className="flex flex-col border-t px-4 py-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className={link} activeProps={active} activeOptions={{ exact: n.to === "/" }}>{n.label}</Link>
          ))}
          {session ? (
            <button onClick={() => { setOpen(false); supabase.auth.signOut(); }} className="btn-outline my-2">Log out</button>
          ) : (
            <Link to="/login" onClick={() => setOpen(false)} className="btn-primary my-2">Login</Link>
          )}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-secondary">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground md:flex-row md:justify-between">
        <span>ROAD-TRACK · Student civic-tech prototype for road infrastructure transparency.</span>
        <span>All projects, contractors and figures shown are fictional demo data — not official government records.</span>
      </div>
    </footer>
  );
}
