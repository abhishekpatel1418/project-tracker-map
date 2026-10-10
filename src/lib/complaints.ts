// Prototype complaint store (browser localStorage). Replace with a database table later.
export type IssueType = "Pothole" | "Stalled Work" | "Incomplete Road" | "Poor Quality Road" | "Other";
export type ComplaintStatus = "Submitted" | "Under Review" | "In Progress" | "Resolved";

export const ISSUE_TYPES: IssueType[] = ["Pothole", "Stalled Work", "Incomplete Road", "Poor Quality Road", "Other"];
export const STATUSES: ComplaintStatus[] = ["Submitted", "Under Review", "In Progress", "Resolved"];

export interface Complaint {
  trackingId: string;
  issueType: IssueType;
  description: string;
  location: string;
  lat: number | null;
  lng: number | null;
  photoName: string | null;
  videoName: string | null;
  submittedAt: string;
  updatedAt?: string;
  status: ComplaintStatus;
}

const KEY = "roadtrack_demo_complaints";

export function generateTrackingId(now = new Date(), rand: () => number = Math.random) {
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(rand() * chars.length)];
  return `RT-DEMO-${ymd}-${s}`;
}

export const LEGACY_SAMPLE_MAP: Record<string, string> = {
  "RT-DEMO-250901-K7P2Q": "RT-DEMO-261002-K7P2Q",
  "RT-DEMO-250914-M3XA8": "RT-DEMO-261007-M3XA8",
  "RT-DEMO-250702-Z9R4T": "RT-DEMO-260915-Z9R4T",
};

const SEED: Complaint[] = [
  { trackingId: "RT-DEMO-261002-K7P2Q", issueType: "Pothole", description: "Deep pothole near the bus stop, two-wheelers swerving. (demo)", location: "Kolar–Ratibad Link Road, Demo District A", lat: 23.19, lng: 77.39, photoName: "pothole.jpg", videoName: null, submittedAt: "2026-10-02T10:20:00Z", updatedAt: "2026-10-08T14:30:00Z", status: "In Progress" },
  { trackingId: "RT-DEMO-261007-M3XA8", issueType: "Stalled Work", description: "No construction activity for 3 weeks. (demo)", location: "Khajuri to Barkheda Road", lat: 23.22, lng: 77.29, photoName: null, videoName: null, submittedAt: "2026-10-07T08:05:00Z", updatedAt: "2026-10-09T09:15:00Z", status: "Under Review" },
  { trackingId: "RT-DEMO-260915-Z9R4T", issueType: "Poor Quality Road", description: "Surface cracking within months of resurfacing. (demo)", location: "Old City Ring Road", lat: 23.27, lng: 77.4, photoName: "cracks.jpg", videoName: null, submittedAt: "2026-09-15T14:40:00Z", updatedAt: "2026-09-28T16:00:00Z", status: "Resolved" },
];

export function loadComplaints(): Complaint[] {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(KEY);
  if (!raw) { localStorage.setItem(KEY, JSON.stringify(SEED)); return SEED; }
  try {
    const list = JSON.parse(raw) as Complaint[];
    const hasLegacy = list.some((c) => c.trackingId in LEGACY_SAMPLE_MAP);
    if (hasLegacy) {
      const userCustom = list.filter((c) => !(c.trackingId in LEGACY_SAMPLE_MAP));
      const upgraded = [...userCustom, ...SEED];
      localStorage.setItem(KEY, JSON.stringify(upgraded));
      return upgraded;
    }
    return list;
  } catch {
    return SEED;
  }
}

function save(list: Complaint[]) { localStorage.setItem(KEY, JSON.stringify(list)); }

export function addComplaint(c: Omit<Complaint, "trackingId" | "submittedAt" | "status" | "updatedAt">): Complaint {
  const list = loadComplaints();
  let id = generateTrackingId();
  while (list.some((x) => x.trackingId === id)) id = generateTrackingId();
  const now = new Date().toISOString();
  const full: Complaint = { ...c, trackingId: id, submittedAt: now, updatedAt: now, status: "Submitted" };
  save([full, ...list]);
  return full;
}

export function findComplaint(id: string) {
  const clean = id.trim().toUpperCase();
  const resolvedId = LEGACY_SAMPLE_MAP[clean] ?? clean;
  return loadComplaints().find((c) => c.trackingId.toUpperCase() === resolvedId || c.trackingId.toUpperCase() === clean);
}

export function updateStatus(id: string, status: ComplaintStatus) {
  const now = new Date().toISOString();
  const list = loadComplaints().map((c) => (c.trackingId === id ? { ...c, status, updatedAt: now } : c));
  save(list);
  return list;
}
