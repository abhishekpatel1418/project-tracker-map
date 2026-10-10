import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Copy, LocateFixed } from "lucide-react";
import { DemoBadge } from "@/components/badges";
import { ISSUE_TYPES, addComplaint, type Complaint, type IssueType } from "@/lib/complaints";
import { getProject, type Department } from "@/lib/demo-data";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth, useSession } from "@/lib/auth";

export const Route = createFileRoute("/report")({
  ssr: false,
  beforeLoad: requireAuth,
  validateSearch: (s: Record<string, unknown>): { project?: string } => (typeof s["project"] === "string" ? { project: s["project"] } : {}),
  head: () => ({
    meta: [
      { title: "Report a Road Issue – ROAD-TRACK" },
      { name: "description", content: "Report potholes, stalled or poor-quality road work with location and photo/video evidence." },
      { property: "og:title", content: "Report a Road Issue – ROAD-TRACK" },
      { property: "og:description", content: "Raise a road complaint and get a tracking ID." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { session } = useSession();
  const { project } = Route.useSearch();
  const proj = project ? getProject(project) : undefined;
  const [department, setDepartment] = useState<Department>(proj?.department ?? "State PWD");
  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(proj ? proj.name : "");
  const [coords, setCoords] = useState<[number, number] | null>(proj ? [proj.lat, proj.lng] : null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [k in "issueType" | "description" | "location"]?: string }>({});
  const [result, setResult] = useState<Complaint | null>(null);
  const [geo, setGeo] = useState("");

  const locate = () => {
    if (!navigator.geolocation) return setGeo("Location not supported.");
    setGeo("Requesting location…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords([p.coords.latitude, p.coords.longitude]); setGeo("Location captured."); },
      () => setGeo("Permission denied. Please type the location."),
    );
  };

  const [photoError, setPhotoError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: { [k in "issueType" | "description" | "location"]?: string } = {};
    if (!issueType) er.issueType = "Choose an issue type.";
    if (description.trim().length < 10) er.description = "Describe the issue (at least 10 characters).";
    if (!location.trim() && !coords) er.location = "Add a location or use GPS.";
    setErrors(er);
    setPhotoError(null);
    if (Object.keys(er).length) return;

    // Private evidence upload requires authenticated citizen account
    if ((photo || video) && !session?.user) {
      setPhotoError("Attaching photo or video evidence requires a signed-in citizen account. Please log in or remove file attachments to submit anonymously.");
      return;
    }

    setSubmitting(true);
    const dept: Department = proj?.department ?? department;

    // 1. Upload evidence if citizen is authenticated
    let evidencePath: string | null = null;
    if (photo && session?.user) {
      try {
        const ext = photo.name.split(".").pop() || "jpg";
        const cleanName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const filePath = `${session.user.id}/${cleanName}`;
        const { data: uploadRes, error: uploadErr } = await supabase.storage
          .from("complaint-evidence")
          .upload(filePath, photo);
        if (uploadErr || !uploadRes) {
          setPhotoError(`Evidence upload failed: ${uploadErr?.message || "Storage error"}. Please try again.`);
          setSubmitting(false);
          return;
        }
        evidencePath = uploadRes.path;
      } catch (err: any) {
        setPhotoError(`Evidence upload failed: ${err.message || "Storage error"}. Please try again.`);
        setSubmitting(false);
        return;
      }
    }

    // 2. Call real Supabase submit_complaint RPC
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("submit_complaint", {
        p_department: dept,
        p_issue_type: issueType as IssueType,
        p_description: description.trim(),
        p_location: location.trim() || "GPS location",
        p_lat: coords?.[0] ?? null,
        p_lng: coords?.[1] ?? null,
        p_photo_name: photo?.name ?? null,
        p_video_name: video?.name ?? null,
        p_evidence_path: evidencePath,
        p_project_id: proj?.id ?? null,
        p_citizen_contact: session?.user?.email ?? null,
      });

      if (!rpcErr && rpcData && typeof rpcData === "object" && (rpcData as any).success) {
        const payload = rpcData as any;
        setResult({
          trackingId: payload.tracking_id,
          issueType: issueType as IssueType,
          description: description.trim(),
          location: location.trim() || "GPS location",
          lat: coords?.[0] ?? null,
          lng: coords?.[1] ?? null,
          photoName: photo?.name ?? null,
          videoName: video?.name ?? null,
          submittedAt: payload.submitted_at || new Date().toISOString(),
          status: "Submitted",
          isDbRecord: true,
        });
        setSubmitting(false);
        return;
      }

      // Cleanup uploaded evidence if submission failed to prevent orphaned storage objects
      if (evidencePath) {
        await supabase.storage.from("complaint-evidence").remove([evidencePath]);
      }

      if (rpcData && (rpcData as any).error === "RATE_LIMIT_EXCEEDED") {
        setErrors({ description: (rpcData as any).message || "Submission limit reached. Please try again later." });
        setSubmitting(false);
        return;
      }
    } catch {
      // If RPC failed with exception, clean up uploaded evidence
      if (evidencePath) {
        await supabase.storage.from("complaint-evidence").remove([evidencePath]);
      }
    }

    // 3. Fallback to local store for offline prototype safety
    const local = addComplaint({
      issueType: issueType as IssueType, description: description.trim(),
      location: location.trim() || "GPS location", lat: coords?.[0] ?? null, lng: coords?.[1] ?? null,
      photoName: photo?.name ?? null, videoName: video?.name ?? null,
    });
    setResult({ ...local, isDbRecord: false });
    setSubmitting(false);
  };

  if (result) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
        <h1 className="mt-4 text-2xl font-bold text-primary">Complaint submitted</h1>
        <p className="mt-2 text-sm text-muted-foreground">Save your Tracking ID to follow its status.</p>
        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-secondary p-5">
          <span className="font-mono text-xl font-semibold text-primary">{result.trackingId}</span>
          <button onClick={() => navigator.clipboard?.writeText(result.trackingId)} aria-label="Copy"><Copy className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        {result.isDbRecord ? (
          <p className="mt-3 text-xs text-accent font-semibold">✓ Official complaint recorded in Supabase database.</p>
        ) : (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">⚠️ Offline prototype record (database migration pending). Stored only on this device.</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/track" search={{ id: result.trackingId }} className="btn-primary">Track this complaint</Link>
          <button onClick={() => { setResult(null); setIssueType(""); setDescription(""); setPhoto(null); setVideo(null); }} className="btn-outline">Report another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <DemoBadge />
      <h1 className="mt-3 text-2xl font-bold text-primary">Report a Road Issue</h1>
      <p className="text-sm text-muted-foreground">Your report will receive a unique tracking ID.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-lg border bg-card p-6">
        <div>
          <span className="mb-2 block text-sm font-medium">Responsible Authority / Department</span>
          {proj ? (
            <div className="rounded border bg-muted/60 p-2.5 text-xs text-muted-foreground">
              Bound to Project: <strong className="text-foreground">{proj.name}</strong> ({proj.department})
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(["State PWD", "NHAI", "PMGSY"] as Department[]).map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setDepartment(d)}
                  className={`rounded border py-2 text-xs font-semibold transition-colors ${
                    department === d
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium">Issue Type</span>
          <div className="flex flex-wrap gap-2">
            {ISSUE_TYPES.map((t) => (
              <button type="button" key={t} onClick={() => setIssueType(t)} className={`rounded-full border px-3 py-1.5 text-sm ${issueType === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{t}</button>
            ))}
          </div>
          {errors.issueType && <p className="mt-1 text-xs text-destructive">{errors.issueType}</p>}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Description</span>
          <textarea rows={4} className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is wrong, since when, how severe?" />
          {errors.description && <span className="mt-1 block text-xs text-destructive">{errors.description}</span>}
        </label>
        <div className="text-sm">
          <span className="mb-1 block font-medium">Location / GPS</span>
          <div className="flex gap-2">
            <input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Road name, landmark, area" />
            <button type="button" onClick={locate} className="btn-outline shrink-0"><LocateFixed className="h-4 w-4" /> GPS</button>
          </div>
          {coords && <p className="mt-1 font-mono text-xs text-muted-foreground">{coords[0].toFixed(5)}, {coords[1].toFixed(5)}</p>}
          {geo && <p className="mt-1 text-xs text-muted-foreground">{geo}</p>}
          {errors.location && <p className="mt-1 text-xs text-destructive">{errors.location}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block font-medium">Photo</span>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="input-field file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1" /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">Video</span>
            <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} className="input-field file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1" /></label>
        </div>
        {photoError && <p className="text-xs text-destructive">{photoError}</p>}
        {!session?.user && (
          <p className="text-xs text-muted-foreground">
            Attaching photo or video evidence requires a signed-in citizen account. Anonymous reports can be submitted without attachments.
          </p>
        )}
        {photo && <img src={URL.createObjectURL(photo)} alt="Preview" className="h-40 rounded border object-cover" />}
        <button disabled={submitting} className="btn-primary w-full !py-3">{submitting ? "Submitting…" : "Submit Complaint"}</button>
      </form>
    </div>
  );
}
