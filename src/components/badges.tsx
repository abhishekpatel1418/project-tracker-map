import { FlaskConical, ShieldCheck, ShieldQuestion, ShieldOff } from "lucide-react";
import type { Verification } from "@/lib/demo-data";
import type { ComplaintStatus } from "@/lib/complaints";

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border border-demo-foreground/30 bg-demo px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-demo-foreground ${className}`}>
      <FlaskConical className="h-3 w-3" /> Demo / Prototype Data
    </span>
  );
}

export function VerificationBadge({ v }: { v: Verification }) {
  const map = {
    "Officially Verified": { cls: "bg-success/10 text-success border-success/30", Icon: ShieldCheck },
    "Awaiting Confirmation": { cls: "bg-warning/15 text-warning-foreground border-warning/40", Icon: ShieldQuestion },
    Unavailable: { cls: "bg-muted text-muted-foreground border-border", Icon: ShieldOff },
  }[v];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${map.cls}`}>
      <map.Icon className="h-3.5 w-3.5" /> {v}
    </span>
  );
}

export function StatusPill({ s }: { s: string }) {
  const cls: Record<string, string> = {
    Submitted: "bg-secondary text-primary",
    "Under Review": "bg-warning/15 text-warning-foreground",
    "In Progress": "bg-chart-5/15 text-primary",
    Resolved: "bg-success/10 text-success",
    Completed: "bg-success/10 text-success",
    Stalled: "bg-destructive/10 text-destructive",
    Sanctioned: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls[s] ?? "bg-muted"}`}>{s as ComplaintStatus}</span>;
}
