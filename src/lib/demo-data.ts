// DEMO / PROTOTYPE DATA — entirely fictional. Not real government data.
// Shape mirrors a future `road_projects` table so a backend can replace this file.

import { formatDistanceToNow } from "date-fns";

export type Department = "State PWD" | "NHAI" | "PMGSY";
export type Verification = "Officially Verified" | "Unavailable" | "Awaiting Confirmation";
export type ProjectStatus = "Sanctioned" | "In Progress" | "Stalled" | "Completed";

export interface RoadProject {
  id: string;
  name: string;
  department: Department;
  category: string;
  contractor: string;
  budgetLakh: number;
  spentLakh: number | null;
  sanctionDate: string;
  startDate: string;
  targetDate: string;
  status: ProjectStatus;
  progress: number;
  verification: Verification;
  district: string;
  lengthKm: number;
  lat: number;
  lng: number;
}

export const DEPARTMENTS: Department[] = ["State PWD", "NHAI", "PMGSY"];

export const DEFAULT_CENTER: [number, number] = [23.2599, 77.4126];

export const PROJECTS: RoadProject[] = [
  { id: "DEMO-PWD-001", name: "Kolar–Ratibad Link Road Widening", department: "State PWD", category: "Major District Road", contractor: "Sample Infra Builders Pvt. Ltd. (fictional)", budgetLakh: 1840, spentLakh: 1120, sanctionDate: "2024-02-14", startDate: "2024-05-01", targetDate: "2027-03-31", status: "In Progress", progress: 61, verification: "Officially Verified", district: "Demo District A", lengthKm: 12.4, lat: 23.185, lng: 77.392 },
  { id: "DEMO-NHAI-002", name: "NH-X Bypass Four-Laning (Package 2)", department: "NHAI", category: "National Highway", contractor: "Placeholder Highways Ltd. (fictional)", budgetLakh: 28500, spentLakh: 9800, sanctionDate: "2024-08-22", startDate: "2025-01-10", targetDate: "2027-06-30", status: "In Progress", progress: 34, verification: "Awaiting Confirmation", district: "Demo District B", lengthKm: 31.0, lat: 23.31, lng: 77.52 },
  { id: "DEMO-PMGSY-003", name: "Village Connectivity Road – Khajuri to Barkheda", department: "PMGSY", category: "Rural Road", contractor: "Example Rural Works Co. (fictional)", budgetLakh: 312, spentLakh: null, sanctionDate: "2024-11-05", startDate: "2025-01-20", targetDate: "2026-06-30", status: "Stalled", progress: 22, verification: "Unavailable", district: "Demo District A", lengthKm: 6.8, lat: 23.22, lng: 77.29 },
  { id: "DEMO-PWD-004", name: "Old City Ring Road Resurfacing", department: "State PWD", category: "Urban Road", contractor: "Mock Paving & Co. (fictional)", budgetLakh: 640, spentLakh: 640, sanctionDate: "2024-03-10", startDate: "2024-06-01", targetDate: "2025-03-31", status: "Completed", progress: 100, verification: "Officially Verified", district: "Demo District C", lengthKm: 9.2, lat: 23.27, lng: 77.40 },
  { id: "DEMO-PMGSY-005", name: "Hilltop Hamlet All-Weather Road", department: "PMGSY", category: "Rural Road", contractor: "Test Constructions (fictional)", budgetLakh: 205, spentLakh: 88, sanctionDate: "2025-01-18", startDate: "2025-03-15", targetDate: "2027-02-28", status: "In Progress", progress: 41, verification: "Awaiting Confirmation", district: "Demo District D", lengthKm: 4.1, lat: 23.36, lng: 77.33 },
  { id: "DEMO-NHAI-006", name: "Expressway Interchange & Service Roads", department: "NHAI", category: "National Highway", contractor: "Prototype Engineering JV (fictional)", budgetLakh: 15200, spentLakh: null, sanctionDate: "2025-06-02", startDate: "2025-09-01", targetDate: "2028-03-31", status: "Sanctioned", progress: 5, verification: "Unavailable", district: "Demo District B", lengthKm: 7.5, lat: 23.17, lng: 77.55 },
  { id: "DEMO-PWD-007", name: "Lakeview Road Drainage & Footpath Upgrade", department: "State PWD", category: "Urban Road", contractor: "Sample Civic Works (fictional)", budgetLakh: 470, spentLakh: 210, sanctionDate: "2024-09-12", startDate: "2024-12-01", targetDate: "2026-05-31", status: "Stalled", progress: 45, verification: "Awaiting Confirmation", district: "Demo District C", lengthKm: 3.6, lat: 23.245, lng: 77.36 },
];

export const getProject = (id: string) => PROJECTS.find((p) => p.id === id);

export const formatLakh = (v: number | null) =>
  v == null ? "Not available" : `₹${v.toLocaleString("en-IN")} lakh`;

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "Not available";
  let date: Date;
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split("-").map(Number);
      date = new Date(y, m - 1, day);
    } else {
      date = new Date(d);
    }
  } else {
    date = d;
  }
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatRelativeTime = (d: string | Date | null | undefined) => {
  if (!d) return "";
  try {
    let date: Date;
    if (typeof d === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split("-").map(Number);
        date = new Date(y, m - 1, day);
      } else {
        date = new Date(d);
      }
    } else {
      date = d;
    }
    if (isNaN(date.getTime())) return "";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
};

export const DEPT_COLOR: Record<Department, string> = {
  "State PWD": "var(--chart-1)",
  NHAI: "var(--chart-4)",
  PMGSY: "var(--chart-2)",
};

export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
