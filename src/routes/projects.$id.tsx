import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DemoBadge, StatusPill, VerificationBadge } from "@/components/badges";
import { formatDate, formatLakh, formatRelativeTime, getProject } from "@/lib/demo-data";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/projects/$id")({
  ssr: false,
  beforeLoad: requireAuth,
  loader: ({ params }) => {
    const project = getProject(params.id);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Project not found – ROAD-TRACK" }, { name: "robots", content: "noindex" }] };
    const p = loaderData.project;
    return {
      meta: [
        { title: `${p.name} – ROAD-TRACK` },
        { name: "description", content: `${p.department} road project (demo data): status, budget and timeline.` },
        { property: "og:title", content: `${p.name} – ROAD-TRACK` },
        { property: "og:description", content: `${p.department} · ${p.status} · demo prototype data` },
      ],
    };
  },
  notFoundComponent: ProjectNotFound,
  component: ProjectDetail,
});

function ProjectNotFound() {
  return <div className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-xl font-bold">Project not found</h1><Link to="/projects" className="btn-outline mt-4">Back to map</Link></div>;
}

function ProjectDetail() {
  const { project: p } = Route.useLoaderData();
  const rows: [string, React.ReactNode][] = [
    ["Project / Road Name", p.name],
    ["Government Department", p.department],
    ["Road Category", p.category],
    ["Contractor", p.contractor],
    ["Total / Contract Budget", formatLakh(p.budgetLakh)],
    ["Amount Spent", formatLakh(p.spentLakh)],
    ["Approval / Sanction Date", formatDate(p.sanctionDate)],
    ["Work Start Date", formatDate(p.startDate)],
    ["Target Completion Date", (
      <span>
        {formatDate(p.targetDate)}
        {p.status !== "Completed" && (
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            ({formatRelativeTime(p.targetDate)})
          </span>
        )}
      </span>
    )],
    ["Current Status", <StatusPill s={p.status} />],
    ["Data Verification Status", <VerificationBadge v={p.verification} />],
    ["District / Length", `${p.district} · ${p.lengthKm} km`],
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to map</Link>
      <div className="mt-4 rounded-lg border bg-card">
        <div className="border-b p-6">
          <DemoBadge />
          <p className="mt-3 font-mono text-xs text-muted-foreground">{p.id}</p>
          <h1 className="mt-1 text-2xl font-bold text-primary md:text-3xl">{p.name}</h1>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Physical progress</span><span>{p.progress}%</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${p.progress}%` }} /></div>
          </div>
        </div>
        <dl className="divide-y">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-6 py-3 sm:grid-cols-[240px_1fr]">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="text-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/50 p-6">
          <p className="text-xs text-muted-foreground">Fictional record for demonstration. Not official government data.</p>
          <Link to="/report" search={{ project: p.id }} className="btn-primary">Report an issue on this road</Link>
        </div>
      </div>
    </div>
  );
}
