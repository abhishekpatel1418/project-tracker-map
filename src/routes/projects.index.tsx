import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { LocateFixed, Search, Globe } from "lucide-react";
import { DemoBadge, StatusPill, VerificationBadge } from "@/components/badges";
import { DEFAULT_CENTER, DEPARTMENTS, DEPT_COLOR, PROJECTS, distanceKm, formatDate, type Department } from "@/lib/demo-data";
import { TinyFishSearch } from "@/components/TinyFishSearch";

const ProjectMap = lazy(() => import("@/components/ProjectMap"));

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Road Project Map – ROAD-TRACK" },
      { name: "description", content: "Interactive map of nearby State PWD, NHAI and PMGSY road projects with live web search." },
      { property: "og:title", content: "Road Project Map – ROAD-TRACK" },
      { property: "og:description", content: "Explore road projects near you on an interactive map or search live web sources." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [viewMode, setViewMode] = useState<"local" | "tinyfish">("local");
  const [depts, setDepts] = useState<Department[]>(DEPARTMENTS);
  const [q, setQ] = useState("");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [user, setUser] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [geoMsg, setGeoMsg] = useState("");

  const list = useMemo(() => {
    const ref = user ?? center;
    return PROJECTS.filter((p) => depts.includes(p.department))
      .filter((p) => !q || `${p.name} ${p.district} ${p.contractor}`.toLowerCase().includes(q.toLowerCase()))
      .map((p) => ({ ...p, dist: distanceKm(ref, [p.lat, p.lng]) }))
      .sort((a, b) => a.dist - b.dist);
  }, [depts, q, user, center]);

  const locate = () => {
    if (!navigator.geolocation) return setGeoMsg("Location not supported in this browser.");
    setGeoMsg("Requesting location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c: [number, number] = [pos.coords.latitude, pos.coords.longitude]; setUser(c); setCenter(c); setGeoMsg("Showing projects relative to your location. Demo projects are placed in a sample region."); },
      () => setGeoMsg("Location permission denied — showing the demo region."),
    );
  };

  const toggle = (d: Department) => setDepts((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Road Projects & Exploration</h1>
          <p className="text-sm text-muted-foreground">Nearby government road works, local demo maps, and live public search.</p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "local" ? (
            <DemoBadge />
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Globe className="h-3 w-3 text-accent" /> Live Web API
            </span>
          )}
        </div>
      </div>

      {/* View Switcher: Prototype Map vs Live Web TinyFish */}
      <div className="mt-4 flex rounded-lg border bg-muted p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setViewMode("local")}
          className={`flex-1 rounded py-2 transition-all ${
            viewMode === "local" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Interactive Map & Local Projects
        </button>
        <button
          type="button"
          onClick={() => setViewMode("tinyfish")}
          className={`flex-1 rounded py-2 transition-all flex items-center justify-center gap-1.5 ${
            viewMode === "tinyfish" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="h-3.5 w-3.5 text-accent" />
          Live Web Search & Fetch (TinyFish)
        </button>
      </div>

      {viewMode === "tinyfish" ? (
        <div className="mt-6">
          <TinyFishSearch />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-60 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input className="input-field !pl-9" placeholder="Search road, district or contractor…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button onClick={locate} className="btn-outline"><LocateFixed className="h-4 w-4" /> Use my location</button>
            {DEPARTMENTS.map((d) => (
              <button key={d} onClick={() => toggle(d)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${depts.includes(d) ? "border-primary bg-secondary text-primary" : "text-muted-foreground"}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: DEPT_COLOR[d] }} />{d}
              </button>
            ))}
          </div>
          {geoMsg && <p className="mt-2 text-xs text-muted-foreground">{geoMsg}</p>}

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="relative z-0 h-[480px] overflow-hidden rounded-lg border lg:h-[640px]">
              <ClientOnly fallback={<div className="grid h-full place-items-center bg-muted text-sm text-muted-foreground">Loading map…</div>}>
                <Suspense fallback={<div className="grid h-full place-items-center bg-muted text-sm text-muted-foreground">Loading map…</div>}>
                  <ProjectMap projects={list} center={center} user={user} selected={selected} onSelect={setSelected} />
                </Suspense>
              </ClientOnly>
            </div>
            <div className="space-y-3 lg:h-[640px] lg:overflow-y-auto lg:pr-1">
              {list.length === 0 && <p className="text-sm text-muted-foreground">No projects match your filters.</p>}
              {list.map((p) => (
                <div key={p.id} onMouseEnter={() => setSelected(p.id)} className={`rounded-lg border bg-card p-4 ${selected === p.id ? "border-primary ring-1 ring-primary" : ""}`}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: DEPT_COLOR[p.department] }} />{p.department}</span>
                    <span className="text-muted-foreground">{p.dist.toFixed(1)} km</span>
                  </div>
                  <h3 className="mt-1 font-semibold leading-snug">{p.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5"><StatusPill s={p.status} /><VerificationBadge v={p.verification} /></div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{p.status === "Completed" ? "Completed" : "Target"}: {formatDate(p.targetDate)}</span>
                    <span>{p.progress}% done</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-demo-foreground">Demo / Prototype Data</span>
                    <Link to="/projects/$id" params={{ id: p.id }} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">Details →</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
