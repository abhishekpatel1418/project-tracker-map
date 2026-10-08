import { describe, it, expect } from "vitest";
import { generateTrackingId } from "@/lib/complaints";

describe("tracking id", () => {
  it("is labeled as demo and encodes the date", () => {
    const id = generateTrackingId(new Date("2026-10-08T00:00:00Z"));
    expect(id).toMatch(/^RT-DEMO-261008-[A-Z2-9]{5}$/);
  });
  it("differs between submissions", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateTrackingId()));
    expect(ids.size).toBeGreaterThan(195);
  });
});
