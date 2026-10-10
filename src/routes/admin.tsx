import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  FileWarning,
  FolderKanban,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LogOut,
  Eye,
  X,
  ExternalLink,
  Lock,
  Building2,
  UserCheck,
  FileText,
  AlertCircle,
  Activity,
  Check,
  RotateCcw,
  MapPin,
  Calendar,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import { DemoBadge, StatusPill, VerificationBadge } from "@/components/badges";
import { STATUSES, loadComplaints, updateStatus, type Complaint, type ComplaintStatus, type IssueType } from "@/lib/complaints";
import { PROJECTS, formatDate, formatLakh, formatRelativeTime, type Project, type Department } from "@/lib/demo-data";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, fetchMyRoles, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/admin-login" });
    const roles = await fetchMyRoles();
    if (roles.length === 0) throw redirect({ to: "/admin-login", search: { denied: 1 } });
    return { roles, adminEmail: data.user.email ?? "", userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "Admin Dashboard – ROAD-TRACK" },
      { name: "description", content: "Department-isolated admin dashboard for road projects and citizen complaints." },
      { property: "og:title", content: "Admin Dashboard – ROAD-TRACK" },
      { property: "og:description", content: "Overview of department-authorized projects and complaints." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

interface AdminComplaint extends Complaint {
  id?: string;
  department?: Department;
  severity?: "Low" | "Medium" | "High" | "Critical";
  citizen_contact?: string | null;
  internal_notes?: string | null;
  resolution_remarks?: string | null;
  public_resolution_summary?: string | null;
  assigned_officer_id?: string | null;
  evidence_path?: string | null;
  project_id?: string | null;
}

interface InvestigationData {
  id?: string;
  tracking_id?: string;
  department?: string;
  citizen_contact?: string | null;
  internal_notes?: string | null;
  resolution_remarks?: string | null;
  severity?: string | null;
  evidence_path?: string | null;
  assigned_officer_id?: string | null;
}

function SeverityBadge({ s }: { s?: "Low" | "Medium" | "High" | "Critical" | string }) {
  const map: Record<string, string> = {
    Critical: "bg-destructive/15 text-destructive border-destructive/30",
    High: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
    Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Low: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
  };
  const val = s || "Medium";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[val] ?? map.Medium}`}>
      {val}
    </span>
  );
}

export interface AdminPageProps {
  testContext?: {
    roles: AppRole[];
    adminEmail: string;
    userId: string;
  };
}

export function AdminPage({ testContext }: AdminPageProps = {}) {
  const context = testContext ?? Route.useRouteContext();
  const { roles, adminEmail, userId } = context;
  const [activeTab, setActiveTab] = useState<"overview" | "complaints" | "projects" | "security">("overview");

  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLiveDb, setIsLiveDb] = useState(false);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Complaints Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [complaintPage, setComplaintPage] = useState(1);
  const pageSize = 10;

  // Road Projects Filters
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>("all");
  const [projectDeptFilter, setProjectDeptFilter] = useState<string>("all");
  const [projectPage, setProjectPage] = useState(1);

  // Selected Complaint Modal & Status Update Form
  const [selectedComplaint, setSelectedComplaint] = useState<AdminComplaint | null>(null);
  const [investigationDetails, setInvestigationDetails] = useState<InvestigationData | null>(null);
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [investigationError, setInvestigationError] = useState<string | null>(null);

  const [newStatus, setNewStatus] = useState<ComplaintStatus>("Submitted");
  const [newSeverity, setNewSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [publicNote, setPublicNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [publicResolutionSummary, setPublicResolutionSummary] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<string | null>(null);

  // Admin Invitation Management (Central Admin only)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("pwd_officer");
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState<any>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitationsList, setInvitationsList] = useState<any[]>([]);

  const isCentralAdmin = roles.includes("central_admin");
  const authorizedDepartments = useMemo(() => {
    if (isCentralAdmin) return ["State PWD", "NHAI", "PMGSY"] as const;
    const list: ("State PWD" | "NHAI" | "PMGSY")[] = [];
    if (roles.includes("pwd_officer")) list.push("State PWD");
    if (roles.includes("nhai_officer")) list.push("NHAI");
    if (roles.includes("pmgsy_officer")) list.push("PMGSY");
    return list;
  }, [roles, isCentralAdmin]);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteResult(null);
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return setInviteError("Please enter a valid official email address.");
    }
    setInviteBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_admin_invitation", {
        p_email: cleanEmail,
        p_role: inviteRole,
        p_expires_days: inviteDays,
      });
      setInviteBusy(false);
      if (error) {
        if (error.code === "PGRST202" || error.code === "42883" || error.message?.includes("function")) {
          return setInviteError("Database migration pending: Apply '20261011002000_admin_invitations_and_activation.sql' in Supabase SQL Editor to enable live invitation generation.");
        }
        return setInviteError(`Failed to generate invitation: ${error.message}`);
      }
      const payload = data as any;
      if (!payload?.success) {
        return setInviteError(payload?.message || payload?.error || "Failed to generate invitation.");
      }
      setInviteResult(payload);
      setInviteEmail("");
      const { data: invData } = await supabase
        .from("admin_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (invData) setInvitationsList(invData);
    } catch (err: any) {
      setInviteBusy(false);
      setInviteError(`Request failed: ${err.message || "Server error"}`);
    }
  };

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch complaints from real Supabase table with department isolation
      let cQuery = supabase.from("complaints").select("*");
      if (!isCentralAdmin) {
        cQuery = cQuery.in("department", authorizedDepartments as unknown as string[]);
      }
      cQuery = cQuery.order("submitted_at", { ascending: false });

      const { data: dbComplaints, error: cErr } = await cQuery;

      if (!cErr && dbComplaints) {
        setIsLiveDb(true);
        setMigrationMissing(false);
        setComplaints(
          dbComplaints.map((c) => ({
            id: c.id,
            trackingId: c.tracking_id,
            department: c.department as Department,
            issueType: c.issue_type as IssueType,
            description: c.description,
            location: c.location,
            lat: c.lat,
            lng: c.lng,
            photoName: c.photo_name,
            videoName: c.video_name,
            evidence_path: c.evidence_path,
            project_id: c.project_id,
            submittedAt: c.submitted_at,
            updatedAt: c.updated_at,
            status: c.status as ComplaintStatus,
            severity: c.severity,
            citizen_contact: c.citizen_contact,
            internal_notes: c.internal_notes,
            resolution_remarks: c.resolution_remarks,
            public_resolution_summary: c.public_resolution_summary,
            assigned_officer_id: c.assigned_officer_id,
          }))
        );
      } else {
        setIsLiveDb(false);
        setMigrationMissing(true);
        // Fallback to local store for offline UI preview only
        const local = loadComplaints();
        setComplaints(local.map((c) => ({ ...c, department: "State PWD" as Department, severity: "Medium" })));
      }

      // 2. Fetch road projects from real Supabase table with department isolation
      let pQuery = supabase.from("road_projects").select("*");
      if (!isCentralAdmin) {
        pQuery = pQuery.in("department", authorizedDepartments as unknown as string[]);
      }
      const { data: dbProj, error: pErr } = await pQuery;

      if (!pErr && dbProj) {
        setProjects(
          dbProj.map((p) => ({
            id: p.id,
            name: p.name,
            department: p.department as Department,
            category: p.category as any,
            contractor: p.contractor,
            budgetLakh: p.budget_lakh,
            spentLakh: p.spent_lakh ?? 0,
            sanctionDate: p.sanction_date,
            startDate: p.start_date,
            targetDate: p.target_date,
            status: p.status,
            progress: p.progress,
            verification: p.verification,
            district: p.district,
            lengthKm: p.length_km,
            lat: p.lat,
            lng: p.lng,
          }))
        );
      } else {
        setProjects(PROJECTS.filter((p) => isCentralAdmin || authorizedDepartments.includes(p.department)));
      }

      // 3. Fetch invitations if Central Admin
      if (isCentralAdmin) {
        try {
          const { data: invData } = await supabase
            .from("admin_invitations")
            .select("*")
            .order("created_at", { ascending: false });
          if (invData) setInvitationsList(invData);
        } catch {
          // Table may not exist yet
        }
      }
    } catch {
      setIsLiveDb(false);
      setMigrationMissing(true);
      const local = loadComplaints();
      setComplaints(local.map((c) => ({ ...c, department: "State PWD" as Department, severity: "Medium" })));
      setProjects(PROJECTS.filter((p) => isCentralAdmin || authorizedDepartments.includes(p.department)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTrack = c.trackingId.toLowerCase().includes(q);
        const matchLoc = c.location.toLowerCase().includes(q);
        const matchDesc = c.description.toLowerCase().includes(q);
        const matchIssue = c.issueType.toLowerCase().includes(q);
        if (!matchTrack && !matchLoc && !matchDesc && !matchIssue) return false;
      }
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (deptFilter !== "all" && c.department !== deptFilter) return false;
      if (severityFilter !== "all" && c.severity !== severityFilter) return false;
      return true;
    });
  }, [complaints, searchQuery, statusFilter, deptFilter, severityFilter]);

  const complaintTotalPages = Math.ceil(filteredComplaints.length / pageSize) || 1;
  const paginatedComplaints = useMemo(() => {
    const start = (complaintPage - 1) * pageSize;
    return filteredComplaints.slice(start, start + pageSize);
  }, [filteredComplaints, complaintPage, pageSize]);

  // Filter road projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (projectSearch.trim()) {
        const q = projectSearch.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchContractor = p.contractor.toLowerCase().includes(q);
        const matchDistrict = p.district.toLowerCase().includes(q);
        if (!matchName && !matchContractor && !matchDistrict) return false;
      }
      if (projectStatusFilter !== "all" && p.status !== projectStatusFilter) return false;
      if (projectDeptFilter !== "all" && p.department !== projectDeptFilter) return false;
      return true;
    });
  }, [projects, projectSearch, projectStatusFilter, projectDeptFilter]);

  const projectTotalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (projectPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, projectPage, pageSize]);

  // Allowed statuses based on current complaint status (matching SQL state machine)
  const allowedStatuses = useMemo<ComplaintStatus[]>(() => {
    if (!selectedComplaint) return STATUSES as unknown as ComplaintStatus[];
    switch (selectedComplaint.status) {
      case "Submitted":
        return ["Submitted", "Under Review"];
      case "Under Review":
        return ["Under Review", "In Progress", "Resolved"];
      case "In Progress":
        return ["In Progress", "Resolved", "Under Review"];
      case "Resolved":
        return ["Resolved", "Under Review"];
      default:
        return STATUSES as unknown as ComplaintStatus[];
    }
  }, [selectedComplaint?.status]);

  // Open complaint detail modal
  const openDetailModal = async (complaint: AdminComplaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status);
    setNewSeverity(complaint.severity ?? "Medium");
    setPublicNote("");
    setInternalNote(complaint.internal_notes ?? "");
    setPublicResolutionSummary(complaint.public_resolution_summary ?? "");
    setStatusUpdateError(null);
    setStatusUpdateSuccess(null);
    setInvestigationDetails(null);
    setInvestigationError(null);

    if (isLiveDb && complaint.id) {
      setInvestigationLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_complaint_investigation_details", {
          p_complaint_id: complaint.id,
        });

        if (!error && data && (data as any).success) {
          const invData = (data as any).data as InvestigationData;
          setInvestigationDetails(invData);
          if (invData.internal_notes) setInternalNote(invData.internal_notes);
          if (invData.severity) setNewSeverity(invData.severity as any);
        } else {
          setInvestigationError(
            (data as any)?.error === "FORBIDDEN"
              ? "Access restricted: Sensitive investigation details are limited to the assigned officer or department leadership."
              : (data as any)?.error || error?.message || "Failed to load investigation details."
          );
        }
      } catch (err: any) {
        setInvestigationError(err.message || "Failed to load investigation details.");
      } finally {
        setInvestigationLoading(false);
      }
    }
  };

  // Submit status update
  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setStatusUpdateError(null);
    setStatusUpdateSuccess(null);

    const noteTrimmed = publicNote.trim();
    if (noteTrimmed.length < 3) {
      setStatusUpdateError("A public note (minimum 3 characters) is required for citizen timeline transparency.");
      return;
    }

    // Require trimmed public resolution summary (minimum 5 chars) when transitioning to Resolved
    if (newStatus === "Resolved" && publicResolutionSummary.trim().length < 5) {
      setStatusUpdateError("A public resolution summary (minimum 5 characters) is required when marking a complaint as Resolved.");
      return;
    }

    setStatusUpdating(true);

    if (isLiveDb && selectedComplaint.id) {
      try {
        const { data, error } = await supabase.rpc("update_complaint_status", {
          p_complaint_id: selectedComplaint.id,
          p_new_status: newStatus,
          p_public_note: noteTrimmed,
          p_internal_note: internalNote.trim() || null,
          p_severity: newSeverity,
          p_public_resolution_summary: publicResolutionSummary.trim() || null,
        });

        if (error || (data && !(data as any).success)) {
          const rpcData = data as any;
          const errMessage =
            rpcData?.message ||
            rpcData?.error ||
            error?.message ||
            "Status update failed.";
          setStatusUpdateError(`Update rejected: ${errMessage}`);
          setStatusUpdating(false);
          return;
        }

        setStatusUpdateSuccess(`Status transitioned to "${newStatus}". Timeline updated.`);
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedComplaint.id
              ? {
                  ...c,
                  status: newStatus,
                  severity: newSeverity,
                  internal_notes: internalNote.trim() || null,
                  public_resolution_summary: publicResolutionSummary.trim() || null,
                  updatedAt: new Date().toISOString(),
                }
              : c
          )
        );
        setSelectedComplaint((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                severity: newSeverity,
                internal_notes: internalNote.trim() || null,
                public_resolution_summary: publicResolutionSummary.trim() || null,
                updatedAt: new Date().toISOString(),
              }
            : null
        );
      } catch (err: any) {
        setStatusUpdateError(`Network exception: ${err.message}`);
      } finally {
        setStatusUpdating(false);
      }
    } else {
      // Prototype demo fallback
      updateStatus(selectedComplaint.trackingId, newStatus);
      setComplaints((prev) =>
        prev.map((c) =>
          c.trackingId === selectedComplaint.trackingId
            ? { ...c, status: newStatus, severity: newSeverity, updatedAt: new Date().toISOString() }
            : c
        )
      );
      setSelectedComplaint((prev) => (prev ? { ...prev, status: newStatus, severity: newSeverity } : null));
      setStatusUpdateSuccess(`Status updated to "${newStatus}" in local demo store.`);
      setStatusUpdating(false);
    }
  };

  // KPI Calculations
  const totalComplaints = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === "Submitted").length;
  const underReviewCount = complaints.filter((c) => c.status === "Under Review").length;
  const inProgressCount = complaints.filter((c) => c.status === "In Progress").length;
  const resolvedCount = complaints.filter((c) => c.status === "Resolved").length;
  const totalProjects = projects.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded bg-primary text-primary-foreground font-bold text-sm">
                RT
              </span>
              <h1 className="text-lg font-bold text-primary font-display">ROAD-TRACK Admin Portal</h1>
            </div>
            {isLiveDb ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> Live DB (RLS Active)
              </span>
            ) : (
              <DemoBadge className="hidden sm:inline-flex" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="hidden md:flex flex-col text-right">
              <span className="font-medium text-foreground">{adminEmail}</span>
              <span className="text-muted-foreground">{roles.map((r) => ROLE_LABELS[r]).join(", ")}</span>
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1.5"
              title="Refresh records from Supabase"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.assign("/admin-login");
              }}
              className="btn-outline !py-1.5 !px-2.5 text-xs text-destructive hover:bg-destructive/10 flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t bg-muted/30">
          <div className="mx-auto flex max-w-7xl overflow-x-auto px-4">
            <nav className="flex gap-1 py-1 text-sm font-medium">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                  activeTab === "overview"
                    ? "bg-card text-primary shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" /> Overview
              </button>
              <button
                onClick={() => setActiveTab("complaints")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                  activeTab === "complaints"
                    ? "bg-card text-primary shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileWarning className="h-4 w-4" /> Complaints
                <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                  {complaints.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("projects")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                  activeTab === "projects"
                    ? "bg-card text-primary shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FolderKanban className="h-4 w-4" /> Road Projects
                <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                  {projects.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                  activeTab === "security"
                    ? "bg-card text-primary shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShieldCheck className="h-4 w-4" /> Jurisdiction & RLS
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Jurisdiction & Security Status Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Authorized Jurisdiction:</span>
            {isCentralAdmin ? (
              <span className="rounded bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                All Departments (Central Admin)
              </span>
            ) : (
              authorizedDepartments.map((d) => (
                <span key={d} className="rounded bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                  {d}
                </span>
              ))
            )}
            <span className="text-xs text-muted-foreground">
              {isLiveDb
                ? "— Enforced at database level by PostgreSQL RLS."
                : "— Prototype mode (Execute migration in Supabase SQL Editor to activate live database)."}
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            Official Officer ID: <span className="font-mono text-foreground font-medium">{userId.slice(0, 8)}…</span>
          </div>
        </div>

        {/* Database Migration Pending Alert */}
        {migrationMissing && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span>Database Migration Pending (Supabase project: mmhvsookdbjkrvplvvwo)</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed">
              The official database schema has not yet been applied to your Supabase project. To enable live database persistence, execute{" "}
              <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono text-[11px]">
                supabase/migrations/20261010183500_roadtrack_core_foundation.sql
              </code>{" "}
              in the Supabase SQL Editor.
            </p>
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              The records displayed below are offline demo prototype data for layout inspection only. They are NOT official government records.
            </p>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-lg border bg-card p-4 shadow-sm border-l-4 border-l-primary">
                <div className="text-xs font-medium text-muted-foreground">Total Complaints</div>
                <div className="mt-2 text-3xl font-bold font-display text-foreground">{totalComplaints}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">In jurisdiction queue</div>
              </div>

              <div className="rounded-lg border bg-card p-4 shadow-sm border-l-4 border-l-warning">
                <div className="text-xs font-medium text-muted-foreground">Pending Review</div>
                <div className="mt-2 text-3xl font-bold font-display text-warning-foreground">{pendingCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Awaiting department triage</div>
              </div>

              <div className="rounded-lg border bg-card p-4 shadow-sm border-l-4 border-l-blue-500">
                <div className="text-xs font-medium text-muted-foreground">Under Review</div>
                <div className="mt-2 text-3xl font-bold font-display text-blue-600 dark:text-blue-400">{underReviewCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Investigation in progress</div>
              </div>

              <div className="rounded-lg border bg-card p-4 shadow-sm border-l-4 border-l-amber-500">
                <div className="text-xs font-medium text-muted-foreground">In Progress</div>
                <div className="mt-2 text-3xl font-bold font-display text-amber-600 dark:text-amber-400">{inProgressCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Field work active</div>
              </div>

              <div className="rounded-lg border bg-card p-4 shadow-sm border-l-4 border-l-accent">
                <div className="text-xs font-medium text-muted-foreground">Resolved Issues</div>
                <div className="mt-2 text-3xl font-bold font-display text-accent">{resolvedCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Officially closed</div>
              </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent Complaints */}
              <div className="rounded-lg border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Recent Complaints</h2>
                    <p className="text-xs text-muted-foreground">Latest citizen submissions requiring officer attention</p>
                  </div>
                  <button onClick={() => setActiveTab("complaints")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    View all ({complaints.length}) <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 divide-y">
                  {complaints.slice(0, 5).map((c) => (
                    <div key={c.trackingId} className="flex items-center justify-between py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">{c.trackingId}</span>
                          <SeverityBadge s={c.severity} />
                          <span className="text-xs text-muted-foreground">· {c.department}</span>
                        </div>
                        <p className="text-xs text-foreground font-medium line-clamp-1">{c.location}</p>
                        <p className="text-[11px] text-muted-foreground">{formatRelativeTime(c.submittedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill s={c.status} />
                        <button onClick={() => openDetailModal(c)} className="btn-outline !py-1 !px-2 text-xs">
                          Review
                        </button>
                      </div>
                    </div>
                  ))}
                  {complaints.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">No complaints in jurisdiction queue.</p>
                  )}
                </div>
              </div>

              {/* Road Projects Overview */}
              <div className="rounded-lg border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Monitored Road Projects</h2>
                    <p className="text-xs text-muted-foreground">Infrastructure road works within your jurisdiction</p>
                  </div>
                  <button onClick={() => setActiveTab("projects")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    View all ({projects.length}) <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 divide-y">
                  {projects.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div className="space-y-1">
                        <Link to="/projects/$id" params={{ id: p.id }} className="text-xs font-semibold text-primary hover:underline line-clamp-1">
                          {p.name}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          {p.department} · {p.contractor} · {formatLakh(p.budgetLakh)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill s={p.status} />
                        <VerificationBadge v={p.verification} />
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">No road projects registered in this department.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMPLAINTS MANAGEMENT */}
        {activeTab === "complaints" && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-semibold text-foreground">Complaint Management Registry</h2>
                  <span className="text-xs text-muted-foreground">
                    {isLiveDb ? "(Official Database Records)" : "(Offline Demo Preview)"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Showing {filteredComplaints.length} of {complaints.length} complaints
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search ID, location, details…"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setComplaintPage(1);
                    }}
                    className="input-field !pl-8 text-xs"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setComplaintPage(1);
                    }}
                    className="input-field text-xs"
                  >
                    <option value="all">All Statuses</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Department Filter (Only Central Admin can pick, otherwise constrained) */}
                <div>
                  <select
                    disabled={!isCentralAdmin}
                    value={deptFilter}
                    onChange={(e) => {
                      setDeptFilter(e.target.value);
                      setComplaintPage(1);
                    }}
                    className="input-field text-xs disabled:opacity-75"
                  >
                    <option value="all">{isCentralAdmin ? "All Departments" : authorizedDepartments[0]}</option>
                    {isCentralAdmin && (
                      <>
                        <option value="State PWD">State PWD</option>
                        <option value="NHAI">NHAI</option>
                        <option value="PMGSY">PMGSY</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Severity Filter */}
                <div>
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                      setComplaintPage(1);
                    }}
                    className="input-field text-xs"
                  >
                    <option value="all">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {(searchQuery || statusFilter !== "all" || (isCentralAdmin && deptFilter !== "all") || severityFilter !== "all") && (
                <div className="flex items-center justify-end pt-1">
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setDeptFilter("all");
                      setSeverityFilter("all");
                      setComplaintPage(1);
                    }}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset all filters
                  </button>
                </div>
              )}
            </div>

            {/* Complaints Table */}
            <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
              <table className="w-full min-w-[840px] text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">Tracking ID</th>
                    <th>Dept.</th>
                    <th>Issue Type</th>
                    <th>Location</th>
                    <th>Severity</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <RefreshCw className="mx-auto h-5 w-5 animate-spin mb-2 text-primary" />
                        Loading complaints registry…
                      </td>
                    </tr>
                  ) : paginatedComplaints.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        {isLiveDb
                          ? "No complaints match the selected filter criteria."
                          : "No complaints found in jurisdiction."}
                      </td>
                    </tr>
                  ) : (
                    paginatedComplaints.map((c) => (
                      <tr key={c.trackingId} className="hover:bg-muted/50 transition-colors">
                        <td className="p-3 font-mono font-semibold text-primary">{c.trackingId}</td>
                        <td>
                          <span className="rounded bg-secondary px-2 py-0.5 font-medium">{c.department}</span>
                        </td>
                        <td>{c.issueType}</td>
                        <td className="max-w-64 truncate" title={c.location}>
                          <div className="truncate font-medium">{c.location}</div>
                          {c.lat != null && c.lng != null && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              GPS: {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                            </div>
                          )}
                        </td>
                        <td>
                          <SeverityBadge s={c.severity} />
                        </td>
                        <td>
                          <div>{formatDate(c.submittedAt)}</div>
                          <div className="text-[10px] text-muted-foreground">{formatRelativeTime(c.submittedAt)}</div>
                        </td>
                        <td>
                          <StatusPill s={c.status} />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openDetailModal(c)}
                            className="btn-primary !py-1 !px-2.5 text-xs inline-flex items-center gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" /> Review / Update
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {complaintTotalPages > 1 && (
              <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
                <div>
                  Page <span className="font-semibold text-foreground">{complaintPage}</span> of{" "}
                  <span className="font-semibold text-foreground">{complaintTotalPages}</span> (
                  {filteredComplaints.length} total)
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={complaintPage <= 1}
                    onClick={() => setComplaintPage((p) => Math.max(1, p - 1))}
                    className="btn-outline !py-1 !px-2 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    disabled={complaintPage >= complaintTotalPages}
                    onClick={() => setComplaintPage((p) => Math.min(complaintTotalPages, p + 1))}
                    className="btn-outline !py-1 !px-2 disabled:opacity-50"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ROAD PROJECTS */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-semibold text-foreground">Infrastructure Road Projects Registry</h2>
                  <span className="text-xs text-muted-foreground">
                    {isLiveDb ? "(Official Database Records)" : "(Offline Demo Preview)"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Showing {filteredProjects.length} of {projects.length} projects
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name, contractor, district…"
                    value={projectSearch}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      setProjectPage(1);
                    }}
                    className="input-field !pl-8 text-xs"
                  />
                  {projectSearch && (
                    <button onClick={() => setProjectSearch("")} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={projectStatusFilter}
                    onChange={(e) => {
                      setProjectStatusFilter(e.target.value);
                      setProjectPage(1);
                    }}
                    className="input-field text-xs"
                  >
                    <option value="all">All Project Statuses</option>
                    <option value="Sanctioned">Sanctioned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Stalled">Stalled</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <select
                    disabled={!isCentralAdmin}
                    value={projectDeptFilter}
                    onChange={(e) => {
                      setProjectDeptFilter(e.target.value);
                      setProjectPage(1);
                    }}
                    className="input-field text-xs disabled:opacity-75"
                  >
                    <option value="all">{isCentralAdmin ? "All Departments" : authorizedDepartments[0]}</option>
                    {isCentralAdmin && (
                      <>
                        <option value="State PWD">State PWD</option>
                        <option value="NHAI">NHAI</option>
                        <option value="PMGSY">PMGSY</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Projects Table */}
            <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
              <table className="w-full min-w-[840px] text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">Project</th>
                    <th>Dept.</th>
                    <th>Contractor</th>
                    <th>District</th>
                    <th>Budget / Spend</th>
                    <th>Target Date</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th className="p-3">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        <RefreshCw className="mx-auto h-5 w-5 animate-spin mb-2 text-primary" />
                        Loading road projects…
                      </td>
                    </tr>
                  ) : paginatedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        No road projects match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedProjects.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <Link to="/projects/$id" params={{ id: p.id }} className="font-semibold text-primary hover:underline line-clamp-1">
                            {p.name}
                          </Link>
                          <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
                        </td>
                        <td>
                          <span className="rounded bg-secondary px-2 py-0.5 font-medium">{p.department}</span>
                        </td>
                        <td className="font-medium text-foreground">{p.contractor}</td>
                        <td>{p.district}</td>
                        <td>
                          <div className="font-semibold">{formatLakh(p.budgetLakh)}</div>
                          <div className="text-[10px] text-muted-foreground">Spent: {formatLakh(p.spentLakh)}</div>
                        </td>
                        <td>{formatDate(p.targetDate)}</td>
                        <td className="w-28">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span>{p.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }} />
                          </div>
                        </td>
                        <td>
                          <StatusPill s={p.status} />
                        </td>
                        <td className="p-3">
                          <VerificationBadge v={p.verification} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {projectTotalPages > 1 && (
              <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
                <div>
                  Page <span className="font-semibold text-foreground">{projectPage}</span> of{" "}
                  <span className="font-semibold text-foreground">{projectTotalPages}</span> ({filteredProjects.length} total)
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={projectPage <= 1}
                    onClick={() => setProjectPage((p) => Math.max(1, p - 1))}
                    className="btn-outline !py-1 !px-2 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    disabled={projectPage >= projectTotalPages}
                    onClick={() => setProjectPage((p) => Math.min(projectTotalPages, p + 1))}
                    className="btn-outline !py-1 !px-2 disabled:opacity-50"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: JURISDICTION & RLS SECURITY */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b pb-4">
                <ShieldCheck className="h-6 w-6 text-accent" />
                <div>
                  <h2 className="text-base font-bold text-foreground">PostgreSQL Row-Level Security Architecture</h2>
                  <p className="text-xs text-muted-foreground">Department-level data isolation guarantees and auditing invariants</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border bg-muted/40 p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Your Officer Profile</h3>
                  <dl className="text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email Identity:</dt>
                      <dd className="font-medium">{adminEmail}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Assigned Roles:</dt>
                      <dd className="font-semibold text-primary">{roles.map((r) => ROLE_LABELS[r]).join(", ")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Permitted Departments:</dt>
                      <dd className="font-semibold">{authorizedDepartments.join(", ")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Central Admin Rights:</dt>
                      <dd>{isCentralAdmin ? "Yes (Full Cross-Dept Authority)" : "No (Constrained to Assigned Dept)"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-md border bg-muted/40 p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent">Active Security Invariants</h3>
                  <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
                    <li><strong className="text-foreground">Engine RLS Enforced:</strong> Table queries evaluate <code className="font-mono text-[10px]">is_department_officer(auth.uid(), department)</code>. Non-authorized rows are never transmitted.</li>
                    <li><strong className="text-foreground">Audited RPC Writes:</strong> Direct table writes are revoked. Transitions must use <code className="font-mono text-[10px]">update_complaint_status</code> with a mandatory public note.</li>
                    <li><strong className="text-foreground">Investigation Read Audit:</strong> Reads of contact info and private notes are logged into the immutable <code className="font-mono text-[10px]">complaint_access_audit</code> table.</li>
                    <li><strong className="text-foreground">Evidence Immutability:</strong> Evidence files referenced by a complaint cannot be deleted or overwritten by citizens.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Central Admin Invitation Management */}
            {isCentralAdmin && (
              <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b pb-4">
                  <UserCheck className="h-6 w-6 text-primary" />
                  <div>
                    <h2 className="text-base font-bold text-foreground">Officer Invitation & Role Provisioning</h2>
                    <p className="text-xs text-muted-foreground">
                      Issue one-time activation codes bound to official department roles (State PWD, NHAI, PMGSY).
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateInvitation} className="grid gap-4 sm:grid-cols-4 items-end">
                  <label className="block text-xs sm:col-span-2">
                    <span className="font-semibold block mb-1">Official Officer Email</span>
                    <input
                      type="email"
                      required
                      placeholder="officer@department.gov.in"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="input-field text-xs"
                    />
                  </label>

                  <label className="block text-xs">
                    <span className="font-semibold block mb-1">Assigned Role & Dept</span>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as AppRole)}
                      className="input-field text-xs"
                    >
                      <option value="pwd_officer">State PWD Officer</option>
                      <option value="nhai_officer">NHAI Officer</option>
                      <option value="pmgsy_officer">PMGSY Officer</option>
                      <option value="central_admin">Central Admin</option>
                    </select>
                  </label>

                  <div>
                    <button
                      type="submit"
                      disabled={inviteBusy}
                      className="btn-primary w-full !py-2.5 text-xs font-semibold"
                    >
                      {inviteBusy ? "Generating…" : "Generate Activation Code"}
                    </button>
                  </div>
                </form>

                {inviteError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {inviteError}
                  </div>
                )}

                {inviteResult && (
                  <div className="rounded-md border border-accent/40 bg-accent/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-accent uppercase tracking-wider">
                        One-Time Officer Activation Code Generated
                      </span>
                      <button
                        onClick={() => navigator.clipboard?.writeText(inviteResult.invitation_code)}
                        className="btn-outline !py-1 !px-2 text-xs flex items-center gap-1"
                      >
                        Copy Code
                      </button>
                    </div>
                    <div className="font-mono text-lg font-bold text-primary p-2 bg-card rounded border">
                      {inviteResult.invitation_code}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Assigned Role: <strong className="text-foreground">{ROLE_LABELS[inviteResult.role as AppRole]}</strong> · Bound Department: <strong className="text-foreground">{inviteResult.department || "All Departments"}</strong> · Recipient: <strong className="text-foreground">{inviteResult.email}</strong>.
                    </p>
                    <p className="text-[11px] text-accent font-medium">
                      Share this activation code securely with the officer. The officer must authenticate with their official email on the Admin Portal to redeem it.
                    </p>
                  </div>
                )}

                {/* Invitations Table */}
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Issued Officer Invitations</h4>
                  {invitationsList.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No invitation records yet in database.</p>
                  ) : (
                    <div className="overflow-x-auto rounded border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted text-muted-foreground border-b">
                          <tr>
                            <th className="p-2.5">Code</th>
                            <th className="p-2.5">Designated Email</th>
                            <th className="p-2.5">Bound Role</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Expires</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {invitationsList.map((inv) => {
                            const isExpired = new Date(inv.expires_at) < new Date();
                            const isClaimed = Boolean(inv.claimed_at);
                            return (
                              <tr key={inv.id || inv.invitation_code} className="hover:bg-muted/40">
                                <td className="p-2.5 font-mono font-semibold text-primary">{inv.invitation_code}</td>
                                <td className="p-2.5">{inv.email}</td>
                                <td className="p-2.5 font-medium">{ROLE_LABELS[inv.role as AppRole] || inv.role}</td>
                                <td className="p-2.5">
                                  {isClaimed ? (
                                    <span className="rounded bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Activated</span>
                                  ) : isExpired ? (
                                    <span className="rounded bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">Expired</span>
                                  ) : (
                                    <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">Active</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-muted-foreground">{formatDate(inv.expires_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* COMPLAINT DETAIL & UPDATE MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card p-6 shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="font-mono text-lg font-bold text-primary">{selectedComplaint.trackingId}</h3>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold">{selectedComplaint.department}</span>
                <StatusPill s={selectedComplaint.status} />
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content Grid */}
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {/* Left Column: Public Complaint & Audited Investigation */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issue Information</h4>
                  <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
                    <div>
                      <span className="text-muted-foreground">Type: </span>
                      <span className="font-semibold text-foreground">{selectedComplaint.issueType}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location: </span>
                      <span className="font-medium text-foreground">{selectedComplaint.location}</span>
                    </div>
                    {selectedComplaint.lat != null && selectedComplaint.lng != null && (
                      <div>
                        <span className="text-muted-foreground">Coordinates: </span>
                        <span className="font-mono">{selectedComplaint.lat.toFixed(5)}, {selectedComplaint.lng.toFixed(5)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Submitted: </span>
                      <span>{formatDate(selectedComplaint.submittedAt)} ({formatRelativeTime(selectedComplaint.submittedAt)})</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Citizen Description</h4>
                  <div className="mt-2 rounded-lg border bg-card p-3 text-xs leading-relaxed text-foreground">
                    {selectedComplaint.description}
                  </div>
                </div>

                {/* Evidence files */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attached Evidence</h4>
                  <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                    {selectedComplaint.photoName || selectedComplaint.videoName ? (
                      <div className="space-y-1">
                        {selectedComplaint.photoName && (
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <ImageIcon className="h-3.5 w-3.5 text-primary" /> Photo: {selectedComplaint.photoName}
                          </div>
                        )}
                        {selectedComplaint.videoName && (
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <VideoIcon className="h-3.5 w-3.5 text-primary" /> Video: {selectedComplaint.videoName}
                          </div>
                        )}
                        {selectedComplaint.evidence_path && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Storage Reference: {selectedComplaint.evidence_path}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span>No files attached with this report.</span>
                    )}
                  </div>
                </div>

                {/* Confidential Investigation Details (Audited Read) */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <Lock className="h-3.5 w-3.5" /> Confidential Investigation Data
                  </div>
                  {investigationLoading ? (
                    <div className="py-2 text-center text-muted-foreground">
                      <RefreshCw className="mx-auto h-4 w-4 animate-spin text-primary" />
                      Loading audited details…
                    </div>
                  ) : investigationError ? (
                    <p className="text-xs text-destructive">{investigationError}</p>
                  ) : investigationDetails ? (
                    <div className="space-y-1.5 text-foreground">
                      <div>
                        <span className="text-muted-foreground">Citizen Contact: </span>
                        <span className="font-semibold">{investigationDetails.citizen_contact || "Anonymous (No contact provided)"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Internal Notes: </span>
                        <span className="font-medium">{investigationDetails.internal_notes || "None recorded"}</span>
                      </div>
                      {investigationDetails.resolution_remarks && (
                        <div>
                          <span className="text-muted-foreground">Resolution Remarks: </span>
                          <span>{investigationDetails.resolution_remarks}</span>
                        </div>
                      )}
                      <p className="pt-1 text-[10px] text-muted-foreground">
                        ✓ Read access recorded in <code className="font-mono">complaint_access_audit</code> table.
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-[11px]">
                      {isLiveDb ? "Audited details will load via secure RPC." : "Offline demo preview (no live audit available)."}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Status Transition Controls */}
              <form onSubmit={handleUpdateStatusSubmit} className="space-y-4 border-t pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> Status Transition & Officer Notes
                </h4>

                {/* Target Status Select */}
                <div>
                  <label htmlFor="new-workflow-status" className="block text-xs font-medium mb-1">New Workflow Status</label>
                  <select
                    id="new-workflow-status"
                    value={newStatus}
                    onChange={(e) => {
                      setNewStatus(e.target.value as ComplaintStatus);
                      if (statusUpdateError) setStatusUpdateError(null);
                    }}
                    className="input-field text-xs font-medium"
                  >
                    {allowedStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                        {s === selectedComplaint?.status
                          ? " (Current)"
                          : s === "Under Review" && selectedComplaint?.status === "Resolved"
                          ? " (Reopen)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Severity Select */}
                <div>
                  <label htmlFor="new-severity" className="block text-xs font-medium mb-1">Priority / Severity Level</label>
                  <select
                    id="new-severity"
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="input-field text-xs"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                {/* Mandatory Public Note */}
                <div>
                  <label htmlFor="public-note" className="block text-xs font-medium mb-1">
                    Public Note <span className="text-destructive">*</span>
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">
                      (Visible to citizen on tracking timeline)
                    </span>
                  </label>
                  <textarea
                    id="public-note"
                    rows={3}
                    placeholder="e.g. Field inspection scheduled for Friday morning by State PWD crew."
                    value={publicNote}
                    onChange={(e) => setPublicNote(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>

                {/* Private Internal Note */}
                <div>
                  <label htmlFor="internal-note" className="block text-xs font-medium mb-1">
                    Private Internal Note
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">
                      (Officer records only; never shown to public)
                    </span>
                  </label>
                  <textarea
                    id="internal-note"
                    rows={2}
                    placeholder="Internal reference, contractor coordination remarks, or budget code."
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>

                {/* Resolution Summary (shown when newStatus is Resolved) */}
                {newStatus === "Resolved" && (
                  <div className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-1.5">
                    <label htmlFor="public-resolution-summary" className="block text-xs font-semibold text-accent">
                      Public Resolution Summary <span className="text-destructive">*</span>
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">
                        (Displayed to citizen upon resolution; minimum 5 characters)
                      </span>
                    </label>
                    <textarea
                      id="public-resolution-summary"
                      rows={2}
                      placeholder="e.g. Road surface patched and sealed by PWD maintenance unit. Inspected on 10 Oct."
                      value={publicResolutionSummary}
                      onChange={(e) => {
                        setPublicResolutionSummary(e.target.value);
                        if (statusUpdateError) setStatusUpdateError(null);
                      }}
                      className="input-field text-xs"
                    />
                  </div>
                )}

                {/* Error & Success Feedback */}
                {statusUpdateError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                    {statusUpdateError}
                  </div>
                )}
                {statusUpdateSuccess && (
                  <div className="rounded-md border border-accent/30 bg-accent/10 p-2.5 text-xs text-accent font-medium">
                    ✓ {statusUpdateSuccess}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedComplaint(null)}
                    className="btn-outline !py-2 !px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={statusUpdating}
                    className="btn-primary !py-2 !px-4 text-xs font-semibold"
                  >
                    {statusUpdating ? "Recording Update…" : "Confirm Status Transition"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
