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

const SEED: Complaint[] = [
  { trackingId: "RT-DEMO-250901-K7P2Q", issueType: "Pothole", description: "Deep pothole near the bus stop, two-wheelers swerving. (demo)", location: "Kolar–Ratibad Link Road, Demo District A", lat: 23.19, lng: 77.39, photoName: "pothole.jpg", videoName: null, submittedAt: "2025-09-01T10:20:00Z", status: "In Progress" },
  { trackingId: "RT-DEMO-250914-M3XA8", issueType: "Stalled Work", description: "No construction activity for 3 months. (demo)", location: "Khajuri to Barkheda Road", lat: 23.22, lng: 77.29, photoName: null, videoName: null, submittedAt: "2025-09-14T08:05:00Z", status: "Under Review" },
  { trackingId: "RT-DEMO-250702-Z9R4T", issueType: "Poor Quality Road", description: "Surface cracking within months of resurfacing. (demo)", location: "Old City Ring Road", lat: 23.27, lng: 77.4, photoName: "cracks.jpg", videoName: null, submittedAt: "2025-07-02T14:40:00Z", status: "Resolved" },
];

export function loadComplaints(): Complaint[] {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(KEY);
  if (!raw) { localStorage.setItem(KEY, JSON.stringify(SEED)); return SEED; }
  try { return JSON.parse(raw) as Complaint[]; } catch { return SEED; }
}

function save(list: Complaint[]) { localStorage.setItem(KEY, JSON.stringify(list)); }

export function addComplaint(c: Omit<Complaint, "trackingId" | "submittedAt" | "status">): Complaint {
  const list = loadComplaints();
  let id = generateTrackingId();
  while (list.some((x) => x.trackingId === id)) id = generateTrackingId();
  const full: Complaint = { ...c, trackingId: id, submittedAt: new Date().toISOString(), status: "Submitted" };
  save([full, ...list]);
  return full;
}

export function findComplaint(id: string) {
  return loadComplaints().find((c) => c.trackingId.toUpperCase() === id.trim().toUpperCase());
}

export function updateStatus(id: string, status: ComplaintStatus) {
  const list = loadComplaints().map((c) => (c.trackingId === id ? { ...c, status } : c));
  save(list);
  return list;
}
