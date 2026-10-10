import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Search, History } from "lucide-react";
import { DemoBadge, StatusPill } from "@/components/badges";
import { STATUSES, findComplaint, type Complaint, type ComplaintStatus } from "@/lib/complaints";
import { formatDate, formatRelativeTime } from "@/lib/demo-data";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/auth";

interface TimelineEntry {
  id: string;
  old_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  public_note: string;
  created_at: string;
}

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
  const [isOfficialRecord, setIsOfficialRecord] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async (v: string) => {
    const clean = v.trim();
    if (!clean) return;
    setLoading(true);
    setSearchError(null);
    setMigrationPending(false);

    try {
      const { data, error } = await supabase.rpc("get_public_complaint_by_tracking_id", {
        p_tracking_id: clean,
      });

      if (!error && data && (data as any).success) {
        const item = (data as any).data;
        const mapped: Complaint = {
          trackingId: item.tracking_id,
          issueType: item.issue_type,
          description: item.description,
          location: item.location,
          lat: item.lat,
          lng: item.lng,
          photoName: null,
          videoName: null,
          submittedAt: item.submitted_at,
          updatedAt: item.updated_at,
          status: item.status,
        };
        setRes(mapped);
        setIsOfficialRecord(true);
        setTimeline(Array.isArray((data as any).timeline) ? (data as any).timeline : []);
        setLoading(false);
        return;
      }

      if (data && !(data as any).success && (data as any).error === "RATE_LIMIT_EXCEEDED") {
        setSearchError((data as any).message ?? "Too many tracking lookups. Please wait a moment.");
        setRes(null);
        setIsOfficialRecord(false);
        setTimeline([]);
        setLoading(false);
        return;
      }

      if (error && (error.code === "PGRST202" || error.code === "42883" || error.message?.includes("function"))) {
        setMigrationPending(true);
      }
    } catch {
      setMigrationPending(true);
    }

    const local = findComplaint(clean);
    if (local) {
      setRes(local);
      setIsOfficialRecord(false);
      setTimeline([]);
    } else {
      setRes(null);
      setIsOfficialRecord(false);
      setTimeline([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (id) search(id); }, [id]);

  const step = res ? STATUSES.indexOf(res.status) : -1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <DemoBadge />
      <h1 className="mt-3 text-2xl font-bold text-primary">Track Complaint</h1>
      <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="mt-5 flex gap-2">
        <input className="input-field font-mono uppercase" placeholder="RT-DEMO-261002-K7P2Q" value={q} onChange={(e) => setQ(e.target.value)} />
        <button disabled={loading} className="btn-primary"><Search className="h-4 w-4" /> {loading ? "Tracking…" : "Track"}</button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">Try the sample ID <button className="font-mono underline" onClick={() => { setQ("RT-DEMO-261002-K7P2Q"); search("RT-DEMO-261002-K7P2Q"); }}>RT-DEMO-261002-K7P2Q</button></p>

      {searchError && <p className="mt-6 rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{searchError}</p>}
      {!searchError && res === null && (
        migrationPending ? (
          <p className="mt-6 rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
            Official tracking database is not yet initialized (pending Supabase SQL migration). No local demo record matches this Tracking ID.
          </p>
        ) : (
          <p className="mt-6 rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            No complaint found for that Tracking ID.
          </p>
        )
      )}
      {res && (
        <div className="mt-6 rounded-lg border bg-card">
          {!isOfficialRecord && (
            <div className="border-b bg-amber-500/10 px-5 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              Prototype Demo Record — This is sample data stored locally on this device for testing, not an official database submission.
            </div>
          )}
          <div className="flex items-center justify-between border-b p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono font-semibold text-primary">{res.trackingId}</span>
              {isOfficialRecord ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">Official Record</span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">Demo Prototype</span>
              )}
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

          {timeline.length > 0 && (
            <div className="border-t p-5">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="h-4 w-4" /> Official Status Timeline
              </h3>
              <ol className="mt-4 space-y-4 border-l-2 border-primary/20 pl-4">
                {timeline.map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-semibold text-primary">{t.new_status}</span>
                      <span className="text-muted-foreground">{formatDate(t.created_at)} ({formatRelativeTime(t.created_at)})</span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/80">{t.public_note}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
