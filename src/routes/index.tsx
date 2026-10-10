import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPinned, FileWarning, SearchCheck, ShieldCheck } from "lucide-react";
import hero from "@/assets/hero-road.jpg";
import { DemoBadge } from "@/components/badges";
import { PROJECTS } from "@/lib/demo-data";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "ROAD-TRACK – Know the Road. Track the Project. Raise the Issue." },
      { name: "description", content: "Citizen platform to discover nearby government road projects, view transparency data and report road issues." },
      { property: "og:title", content: "ROAD-TRACK – Road Transparency Platform" },
      { property: "og:description", content: "Know the Road. Track the Project. Raise the Issue." },
    ],
  }),
  component: Index,
});

function Index() {
  const features = [
    { Icon: MapPinned, t: "Discover projects", d: "Find State PWD, NHAI and PMGSY road works near you on an interactive map." },
    { Icon: ShieldCheck, t: "See the numbers", d: "Budget, spend, contractor, dates and a clear data-verification label for every project." },
    { Icon: FileWarning, t: "Raise an issue", d: "Report potholes, stalled or poor-quality work with GPS location and photo/video evidence." },
    { Icon: SearchCheck, t: "Track progress", d: "Use your Tracking ID to follow the complaint from Submitted to Resolved." },
  ];
  return (
    <>
      <section className="relative overflow-hidden">
        <img src={hero} alt="Aerial view of a highway under construction" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-32">
          <DemoBadge />
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-tight text-primary-foreground md:text-6xl">
            Know the Road. Track the Project. <span className="text-accent">Raise the Issue.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-primary-foreground/85 md:text-lg">
            ROAD-TRACK brings public road infrastructure into the open — who is building it, how much it costs, and when it should be done.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/projects" className="btn-accent !px-5 !py-3">Explore Road Projects</Link>
            <Link to="/report" className="btn-outline !px-5 !py-3">Report a Road Issue</Link>
          </div>
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x px-4 py-6 text-center">
          {[["Demo projects", PROJECTS.length], ["Departments", 3], ["Verification levels", 3]].map(([l, v]) => (
            <div key={l}><div className="font-display text-2xl font-bold text-primary">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-2xl font-bold text-primary">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, t, d }) => (
            <div key={t} className="rounded-lg border bg-card p-5">
              <Icon className="h-6 w-6 text-accent" />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 rounded border border-demo-foreground/20 bg-demo/50 p-4 text-sm text-demo-foreground">
          This is a student prototype. Every project, contractor, budget and complaint shown is fictional demo data and is not official government information.
        </p>
      </section>
    </>
  );
}
