import { describe, it, expect } from "vitest";
import { generateTrackingId, findComplaint } from "@/lib/complaints";
import { formatDate, formatRelativeTime } from "@/lib/demo-data";

describe("tracking id", () => {
  it("is labeled as demo and encodes the date", () => {
    const id = generateTrackingId(new Date("2026-10-08T00:00:00Z"));
    expect(id).toMatch(/^RT-DEMO-261008-[A-Z2-9]{5}$/);
  });
  it("differs between submissions", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateTrackingId()));
    expect(ids.size).toBeGreaterThan(195);
  });
  it("retrieves the active October 2026 demo complaint", () => {
    const found = findComplaint("RT-DEMO-261002-K7P2Q");
    expect(found).toBeDefined();
    expect(found?.status).toBe("In Progress");
    expect(found?.submittedAt).toBe("2026-10-02T10:20:00Z");
  });
  it("resolves legacy sample tracking ID gracefully", () => {
    const found = findComplaint("RT-DEMO-250901-K7P2Q");
    expect(found).toBeDefined();
    expect(found?.trackingId).toBe("RT-DEMO-261002-K7P2Q");
  });
});

describe("date formatting helpers", () => {
  it("formats date strings consistently to Indian locale standard", () => {
    expect(formatDate("2026-10-02T10:20:00Z")).toContain("2026");
    expect(formatDate("2027-03-31")).toContain("2027");
  });
  it("computes relative time strings without error", () => {
    const rel = formatRelativeTime("2026-10-02T10:20:00Z");
    expect(typeof rel).toBe("string");
    expect(rel.length).toBeGreaterThan(0);
  });
});

