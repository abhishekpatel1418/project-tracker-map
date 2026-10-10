import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Search } from "lucide-react";
import { DemoBadge, StatusPill } from "@/components/badges";
import { STATUSES, findComplaint, type Complaint } from "@/lib/complaints";
import { formatDate, formatRelativeTime } from "@/lib/demo-data";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/track")({
  ssr: false,
  beforeLoad: requireAuth,
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  head: () => ({
    meta: [
      { title: "Track a Complaint – ROAD-TRACK" },
      { name: "description", content: "Enter your tracking ID to see the status of your road complaint." },
      { property: "og:title", content: "Track a Complaint – ROAD-TRACK" },
      { property: "og:description", content: "Follow your road complaint from Submitted to Resolved." },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { id } = Route.useSearch();
  const [q, setQ] = useState(id ?? "");
  const [res, setRes] = useState<Complaint | null | undefined>(undefined);

  const search = (v: string) => setRes(findComplaint(v) ?? null);
  useEffect(() => { if (id) search(id); }, [id]);

  const step = res ? STATUSES.indexOf(res.status) : -1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <DemoBadge />
      <h1 className="mt-3 text-2xl font-bold text-primary">Track Complaint</h1>
      <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="mt-5 flex gap-2">
        <input className="input-field font-mono uppercase" placeholder="RT-DEMO-261002-K7P2Q" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary"><Search className="h-4 w-4" /> Track</button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">Try the sample ID <button className="font-mono underline" onClick={() => { setQ("RT-DEMO-261002-K7P2Q"); search("RT-DEMO-261002-K7P2Q"); }}>RT-DEMO-261002-K7P2Q</button></p>

      {res === null && <p className="mt-6 rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">No complaint found for that Tracking ID.</p>}
      {res && (
        <div className="mt-6 rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono font-semibold text-primary">{res.trackingId}</span>
              <span className="text-xs text-muted-foreground">
                · Updated {formatRelativeTime(res.updatedAt ?? res.submittedAt)}
              </span>
            </div>
            <StatusPill s={res.status} />
          </div>
          <ol className="grid grid-cols-4 gap-2 border-b p-5">
            {STATUSES.map((s, i) => (
              <li key={s} className="text-center">
                <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold ${i <= step ? "border-accent bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{i <= step ? <Check className="h-4 w-4" /> : i + 1}</div>
                <div className={`mt-1 text-[11px] ${i <= step ? "font-semibold" : "text-muted-foreground"}`}>{s}</div>
              </li>
            ))}
          </ol>
          <dl className="divide-y text-sm">
            {[
              ["Issue type", res.issueType],
              ["Location", res.location + (res.lat != null ? ` (${res.lat.toFixed(4)}, ${res.lng!.toFixed(4)})` : "")],
              ["Submitted", `${formatDate(res.submittedAt)} (${formatRelativeTime(res.submittedAt)})`],
              ...(res.updatedAt && res.updatedAt !== res.submittedAt
                ? [["Last Status Update", `${formatDate(res.updatedAt)} (${formatRelativeTime(res.updatedAt)})`]]
                : []),
              ["Details", res.description],
              ["Evidence", [res.photoName, res.videoName].filter(Boolean).join(", ") || "None attached"],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[140px_1fr]"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
