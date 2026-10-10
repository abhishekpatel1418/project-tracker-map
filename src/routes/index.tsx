import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPinned, FileWarning, SearchCheck, ShieldCheck, User, ArrowRight } from "lucide-react";
import hero from "@/assets/hero-road.jpg";
import { PROJECTS } from "@/lib/demo-data";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
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
  const { session } = useSession();
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
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3.5 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span>National Road Transparency & Grievance Portal</span>
          </div>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-tight text-primary-foreground md:text-6xl">
            Know the Road. Track the Project. <span className="text-accent">Raise the Issue.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-primary-foreground/85 md:text-lg">
            ROAD-TRACK brings public road infrastructure into the open — monitoring highway development, sanctions, and grievance resolution across jurisdictions.
          </p>

          {session ? (
            <div className="mt-8 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/20 px-3.5 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm">
                <User className="h-3.5 w-3.5 text-accent" />
                <span>Signed in as citizen: <strong className="font-semibold text-accent">{session.user.email}</strong></span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/report" className="btn-accent flex items-center gap-2 !px-5 !py-3 text-sm font-semibold shadow-md">
                  <FileWarning className="h-4 w-4" />
                  <span>Report a Road Issue</span>
                </Link>
                <Link to="/track" className="btn-outline !bg-card/20 border-primary-foreground/40 text-primary-foreground hover:!bg-card/35 flex items-center gap-2 !px-5 !py-3 text-sm font-semibold backdrop-blur-sm">
                  <SearchCheck className="h-4 w-4" />
                  <span>Track Complaint</span>
                </Link>
                <Link to="/projects" className="btn-outline !bg-card/20 border-primary-foreground/40 text-primary-foreground hover:!bg-card/35 flex items-center gap-2 !px-5 !py-3 text-sm font-semibold backdrop-blur-sm">
                  <MapPinned className="h-4 w-4" />
                  <span>Explore Road Projects</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/login" className="btn-accent flex items-center gap-2 !px-6 !py-3 text-sm font-semibold shadow-md">
                <User className="h-4 w-4" />
                <span>Login as User</span>
              </Link>
              <Link to="/admin-login" className="btn-outline !bg-card/10 border-primary-foreground/40 text-primary-foreground hover:!bg-card/25 flex items-center gap-2 !px-6 !py-3 text-sm font-semibold backdrop-blur-sm">
                <ShieldCheck className="h-4 w-4" />
                <span>Login as Admin</span>
              </Link>
            </div>
          )}

          <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary-foreground">
                <User className="h-4 w-4 text-accent" />
                <span>Citizen Services</span>
              </div>
              <p className="mt-1.5 text-xs text-primary-foreground/80 leading-relaxed">
                Report road defects, upload geo-tagged photo evidence, and track grievance resolution status.
              </p>
              {session ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link to="/report" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                    Report Issue <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link to="/track" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                    Track Status <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <Link to="/login" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
                  Login as User <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <div className="rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary-foreground">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span>Officer & Admin Portal</span>
              </div>
              <p className="mt-1.5 text-xs text-primary-foreground/80 leading-relaxed">
                Authorized access for State PWD, NHAI, PMGSY officers and central administrators.
              </p>
              <Link to="/admin-login" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
                Login as Admin <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x px-4 py-6 text-center">
          {[["Road projects", PROJECTS.length], ["Departments", 3], ["Verification levels", 3]].map(([l, v]) => (
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
        <div className="mt-8 rounded-lg border bg-muted/50 p-4 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Public Information Notice:</strong> ROAD-TRACK provides an integrated digital platform for monitoring road infrastructure works, tenders, and public grievance redressal across participating authorities (State PWD, NHAI, PMGSY). Record verification status is displayed per project.
        </div>
      </section>
    </>
  );
}
