import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DemoBadge, StatusPill, VerificationBadge } from "@/components/badges";
import { STATUSES, loadComplaints, updateStatus, type Complaint, type ComplaintStatus } from "@/lib/complaints";
import { PROJECTS, formatDate, formatLakh } from "@/lib/demo-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard – ROAD-TRACK" },
      { name: "description", content: "Prototype admin dashboard for road projects and citizen complaints." },
      { property: "og:title", content: "Admin Dashboard – ROAD-TRACK" },
      { property: "og:description", content: "Overview of projects and complaints (prototype)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  useEffect(() => setComplaints(loadComplaints()), []);
  const pending = complaints.filter((c) => c.status !== "Resolved").length;
  const stats = [
    ["Total Road Projects", PROJECTS.length],
    ["Total Complaints", complaints.length],
    ["Pending Complaints", pending],
    ["Resolved Complaints", complaints.length - pending],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
        <DemoBadge />
      </div>
      <p className="text-sm text-muted-foreground">Prototype interface — no access control yet.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([l, v], i) => (
          <div key={l} className={`rounded-lg border bg-card p-5 ${i === 2 ? "border-l-4 border-l-warning" : i === 3 ? "border-l-4 border-l-accent" : "border-l-4 border-l-primary"}`}>
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 font-display text-3xl font-bold">{v}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold">Complaints</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-3">Tracking ID</th><th>Issue</th><th>Location</th><th>Submitted</th><th>Status</th><th className="pr-3">Update</th></tr></thead>
            <tbody className="divide-y">
              {complaints.map((c) => (
                <tr key={c.trackingId}>
                  <td className="p-3 font-mono text-xs">{c.trackingId}</td>
                  <td>{c.issueType}</td>
                  <td className="max-w-56 truncate">{c.location}</td>
                  <td>{formatDate(c.submittedAt)}</td>
                  <td><StatusPill s={c.status} /></td>
                  <td className="pr-3">
                    <select className="input-field !w-auto !py-1" value={c.status} onChange={(e) => setComplaints(updateStatus(c.trackingId, e.target.value as ComplaintStatus))}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold">Road Projects</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-3">Project</th><th>Dept.</th><th>Budget</th><th>Status</th><th>Verification</th></tr></thead>
            <tbody className="divide-y">
              {PROJECTS.map((p) => (
                <tr key={p.id}>
                  <td className="p-3"><Link to="/projects/$id" params={{ id: p.id }} className="font-medium text-primary hover:underline">{p.name}</Link></td>
                  <td>{p.department}</td>
                  <td>{formatLakh(p.budgetLakh)}</td>
                  <td><StatusPill s={p.status} /></td>
                  <td><VerificationBadge v={p.verification} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
