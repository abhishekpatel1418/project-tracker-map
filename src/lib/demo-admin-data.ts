import type { ComplaintStatus, IssueType } from "./complaints";
import type { Department } from "./demo-data";

export interface DemoAdminComplaint {
  id: string;
  trackingId: string;
  department: Department;
  issueType: IssueType;
  description: string;
  location: string;
  lat: number | null;
  lng: number | null;
  photoName: string | null;
  videoName: string | null;
  evidence_path?: string | null;
  submittedAt: string;
  updatedAt?: string;
  status: ComplaintStatus;
  severity: "Low" | "Medium" | "High" | "Critical";
  citizen_contact: string | null;
  internal_notes: string | null;
  public_resolution_summary?: string | null;
  assigned_officer_id?: string | null;
  project_id?: string | null;
}

export const INITIAL_DEMO_ADMIN_COMPLAINTS: DemoAdminComplaint[] = [
  {
    id: "demo-complaint-001",
    trackingId: "RT-DEMO-261011-PWD01",
    department: "State PWD",
    issueType: "Pothole",
    description: "Deep pothole cluster (approx 15cm depth) near bus terminal creating hazardous condition for two-wheelers during night hours. (Demo Record)",
    location: "Kolar–Ratibad Link Road, Sector 3 Junction, Demo District A",
    lat: 23.185,
    lng: 77.392,
    photoName: "kolar_pothole_cluster.jpg",
    videoName: null,
    submittedAt: "2026-10-09T08:30:00Z",
    updatedAt: "2026-10-10T14:15:00Z",
    status: "In Progress",
    severity: "Critical",
    citizen_contact: "citizen.rahul@sample-citizen.org (Fictional)",
    internal_notes: "Inspected by Assistant Engineer (State PWD Sub-Division 2). Hot-mix asphalt patch team scheduled for site mobilization.",
    public_resolution_summary: null,
    assigned_officer_id: "PWD-EXEC-ENG-04",
    project_id: "DEMO-PWD-001",
  },
  {
    id: "demo-complaint-002",
    trackingId: "RT-DEMO-261011-NHAI02",
    department: "NHAI",
    issueType: "Poor Quality Road",
    description: "Expansion joint unevenness and surface rutting on flyover bridge causing vehicle jolts at 80 km/h design speed. (Demo Record)",
    location: "NH-48 Jaipur–Bhopal Expressway Section, Km 42+200, Demo District B",
    lat: 23.31,
    lng: 77.52,
    photoName: "nhai_expansion_joint.jpg",
    videoName: "bridge_surface_vibration.mp4",
    submittedAt: "2026-10-08T11:45:00Z",
    updatedAt: "2026-10-09T16:20:00Z",
    status: "Under Review",
    severity: "High",
    citizen_contact: "transport.safety@sample-fleet.org (Fictional)",
    internal_notes: "Notice issued to concessionaire bridge maintenance unit. Laser profilometer inspection requested.",
    public_resolution_summary: null,
    assigned_officer_id: "NHAI-PD-BHOPAL",
    project_id: "DEMO-NHAI-002",
  },
  {
    id: "demo-complaint-003",
    trackingId: "RT-DEMO-261011-PMGSY03",
    department: "PMGSY",
    issueType: "Stalled Work",
    description: "Culvert masonry work stalled for past 4 weeks after initial earthwork. Monsoon drainage back-flooding village entry road. (Demo Record)",
    location: "Village Connectivity Road, Khajuri to Barkheda Hamlet, Demo District A",
    lat: 23.22,
    lng: 77.29,
    photoName: "stalled_culvert_khajuri.jpg",
    videoName: null,
    submittedAt: "2026-10-07T09:10:00Z",
    updatedAt: "2026-10-07T09:10:00Z",
    status: "Submitted",
    severity: "High",
    citizen_contact: "sarpanch.khajuri@rural-demo.in (Fictional)",
    internal_notes: "Awaiting formal review by PMGSY Project Implementation Unit (PIU) executive engineer.",
    public_resolution_summary: null,
    assigned_officer_id: null,
    project_id: "DEMO-PMGSY-003",
  },
  {
    id: "demo-complaint-004",
    trackingId: "RT-DEMO-261011-PWD04",
    department: "State PWD",
    issueType: "Poor Quality Road",
    description: "Bituminous surface peeling within 4 months of urban resurfacing contract. Aggregate stone raveling across pedestrian lane. (Demo Record)",
    location: "Old City Ring Road, Heritage Gate Corridor, Demo District C",
    lat: 23.27,
    lng: 77.4,
    photoName: "ringroad_raveling.jpg",
    videoName: null,
    submittedAt: "2026-09-18T14:20:00Z",
    updatedAt: "2026-10-01T17:00:00Z",
    status: "Resolved",
    severity: "Medium",
    citizen_contact: "resident.anita@demo-city.org (Fictional)",
    internal_notes: "Contractor notified under Defect Liability Period (DLP) Clause 14. Surface re-milled and micro-surfaced at contractor cost.",
    public_resolution_summary: "Defective 200m section completely re-milled and rectified with polymer-modified bitumen under warranty on 1 Oct 2026.",
    assigned_officer_id: "PWD-EXEC-ENG-02",
    project_id: "DEMO-PWD-004",
  },
  {
    id: "demo-complaint-005",
    trackingId: "RT-DEMO-261011-PMGSY05",
    department: "PMGSY",
    issueType: "Incomplete Road",
    description: "All-weather blacktop terminated 800 meters short of hilltop tribal hamlet. Final connection impassable in light rain. (Demo Record)",
    location: "Hilltop Hamlet All-Weather Road, Demo District D",
    lat: 23.36,
    lng: 77.33,
    photoName: "unpaved_section.jpg",
    videoName: null,
    submittedAt: "2026-10-10T12:00:00Z",
    updatedAt: "2026-10-10T12:00:00Z",
    status: "Submitted",
    severity: "Medium",
    citizen_contact: "community.rep@sample-hill.in (Fictional)",
    internal_notes: "Cross-checked with DPR chainage. Sanctioned package terminates at Ch 4.100 km; extension sanction under consideration.",
    public_resolution_summary: null,
    assigned_officer_id: null,
    project_id: "DEMO-PMGSY-005",
  },
  {
    id: "demo-complaint-006",
    trackingId: "RT-DEMO-261011-NHAI06",
    department: "NHAI",
    issueType: "Other",
    description: "High-mast median lighting non-functional for 2km on expressway interchange approach road. High accident risk. (Demo Record)",
    location: "Expressway Interchange & Service Roads, Outer Loop, Demo District B",
    lat: 23.17,
    lng: 77.55,
    photoName: "dark_interchange.jpg",
    videoName: null,
    submittedAt: "2026-10-06T19:40:00Z",
    updatedAt: "2026-10-09T11:00:00Z",
    status: "Resolved",
    severity: "Critical",
    citizen_contact: "safety.inspector@nhai-audit.gov.in (Fictional)",
    internal_notes: "Power transformer tripped due to underground cable fault. Concessionaire electrical wing replaced junction box and tested feed.",
    public_resolution_summary: "Main 11kV step-down transformer cable replaced and all 16 high-mast towers powered and verified operational.",
    assigned_officer_id: "NHAI-SITE-ENG-08",
    project_id: "DEMO-NHAI-006",
  },
  {
    id: "demo-complaint-007",
    trackingId: "RT-DEMO-261011-PWD07",
    department: "State PWD",
    issueType: "Stalled Work",
    description: "Drainage excavation trenches left open along pedestrian footpath with no barricading for over 2 weeks. (Demo Record)",
    location: "Lakeview Road Promenade Upgrade, Demo District C",
    lat: 23.245,
    lng: 77.36,
    photoName: "open_trench_lakeview.jpg",
    videoName: null,
    submittedAt: "2026-10-09T16:10:00Z",
    updatedAt: "2026-10-10T10:30:00Z",
    status: "In Progress",
    severity: "High",
    citizen_contact: "civic.forum@demo-lake.org (Fictional)",
    internal_notes: "Contractor penalised under civic safety code. Temporary retroreflective barricading installed; precast drain slabs delivered to site.",
    public_resolution_summary: null,
    assigned_officer_id: "PWD-EXEC-ENG-02",
    project_id: "DEMO-PWD-007",
  },
];

const DEMO_ADMIN_STORAGE_KEY = "roadtrack_demo_admin_complaints_v1";

export function loadDemoAdminComplaints(): DemoAdminComplaint[] {
  if (typeof window === "undefined") return INITIAL_DEMO_ADMIN_COMPLAINTS;
  const raw = localStorage.getItem(DEMO_ADMIN_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(DEMO_ADMIN_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ADMIN_COMPLAINTS));
    return INITIAL_DEMO_ADMIN_COMPLAINTS;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return INITIAL_DEMO_ADMIN_COMPLAINTS;
  } catch {
    return INITIAL_DEMO_ADMIN_COMPLAINTS;
  }
}

export function updateDemoAdminComplaintStatus(
  trackingId: string,
  newStatus: ComplaintStatus,
  severity?: "Low" | "Medium" | "High" | "Critical",
  publicNote?: string,
  internalNote?: string,
  publicResolutionSummary?: string
): DemoAdminComplaint[] {
  const current = loadDemoAdminComplaints();
  const updated = current.map((c) => {
    if (c.trackingId !== trackingId) return c;
    return {
      ...c,
      status: newStatus,
      severity: severity ?? c.severity,
      internal_notes: internalNote ?? c.internal_notes,
      public_resolution_summary: publicResolutionSummary ?? c.public_resolution_summary,
      updatedAt: new Date().toISOString(),
    };
  });
  if (typeof window !== "undefined") {
    localStorage.setItem(DEMO_ADMIN_STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function resetDemoAdminComplaints(): DemoAdminComplaint[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(DEMO_ADMIN_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ADMIN_COMPLAINTS));
  }
  return INITIAL_DEMO_ADMIN_COMPLAINTS;
}

export interface DepartmentSummary {
  department: Department;
  totalComplaints: number;
  submitted: number;
  underReview: number;
  inProgress: number;
  resolved: number;
  activeProjects: number;
}

export function getDepartmentSummaries(complaints: DemoAdminComplaint[]): DepartmentSummary[] {
  const depts: Department[] = ["State PWD", "NHAI", "PMGSY"];
  return depts.map((d) => {
    const list = complaints.filter((c) => c.department === d);
    return {
      department: d,
      totalComplaints: list.length,
      submitted: list.filter((c) => c.status === "Submitted").length,
      underReview: list.filter((c) => c.status === "Under Review").length,
      inProgress: list.filter((c) => c.status === "In Progress").length,
      resolved: list.filter((c) => c.status === "Resolved").length,
      activeProjects: d === "State PWD" ? 3 : d === "NHAI" ? 2 : 2,
    };
  });
}
