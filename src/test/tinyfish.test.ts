import { describe, it, expect } from "vitest";
import {
  buildSearchQuery,
  isOfficialGovernmentSource,
  inferDepartment,
} from "@/lib/tinyfish";

describe("TinyFish Search & Fetch Integration", () => {
  describe("buildSearchQuery", () => {
    it("targets NHAI road projects correctly", () => {
      const q = buildSearchQuery("NH-44", "NHAI");
      expect(q).toContain("NH-44");
      expect(q).toContain("NHAI");
      expect(q).toContain("National Highway");
    });

    it("targets State PWD road construction projects correctly", () => {
      const q = buildSearchQuery("Bhopal ring road", "State PWD");
      expect(q).toContain("Bhopal ring road");
      expect(q).toContain("State PWD");
    });

    it("targets PMGSY rural road projects correctly", () => {
      const q = buildSearchQuery("Khajuri package", "PMGSY");
      expect(q).toContain("Khajuri package");
      expect(q).toContain("PMGSY");
      expect(q).toContain("rural road");
    });

    it("handles empty user input with default department queries", () => {
      const nhaiDefault = buildSearchQuery("", "NHAI");
      expect(nhaiDefault).toContain("NHAI");

      const pwdDefault = buildSearchQuery("", "State PWD");
      expect(pwdDefault).toContain("State PWD");

      const pmgsyDefault = buildSearchQuery("", "PMGSY");
      expect(pmgsyDefault).toContain("PMGSY");
    });
  });

  describe("isOfficialGovernmentSource", () => {
    it("recognizes .gov.in domains as official government sources", () => {
      expect(isOfficialGovernmentSource("https://nhai.gov.in/project-detail/123")).toBe(true);
      expect(isOfficialGovernmentSource("https://pwd.mp.gov.in/tenders/456")).toBe(true);
      expect(isOfficialGovernmentSource("https://morth.nic.in/schemes")).toBe(true);
      expect(isOfficialGovernmentSource("https://omms.nic.in/pmgsy-progress")).toBe(true);
    });

    it("identifies commercial or third-party web domains as unverified", () => {
      expect(isOfficialGovernmentSource("https://www.thehindu.com/news/national/road-work")).toBe(false);
      expect(isOfficialGovernmentSource("https://example-blog.org/highway-review")).toBe(false);
      expect(isOfficialGovernmentSource("https://infrastructure-tracker.com/potholes")).toBe(false);
    });
  });

  describe("inferDepartment", () => {
    it("preserves explicitly selected department", () => {
      expect(inferDepartment("NHAI", "Sample Project", "Sample Snippet", "https://example.com")).toBe("NHAI");
      expect(inferDepartment("State PWD", "Sample Project", "Sample Snippet", "https://example.com")).toBe("State PWD");
      expect(inferDepartment("PMGSY", "Sample Project", "Sample Snippet", "https://example.com")).toBe("PMGSY");
    });

    it("infers department from title, snippet, or URL when 'All' is selected", () => {
      expect(
        inferDepartment("All", "NHAI Package 4 Tender Award", "Four laning work", "https://nhai.gov.in")
      ).toBe("NHAI");

      expect(
        inferDepartment("All", "PMGSY Batch 2 Connectivity", "Rural connectivity report", "https://omms.nic.in")
      ).toBe("PMGSY");

      expect(
        inferDepartment("All", "State PWD District Road Maintenance", "Resurfacing contract", "https://pwd.mp.gov.in")
      ).toBe("State PWD");

      expect(
        inferDepartment("All", "Random infrastructure news", "Some description", "https://genericnews.com")
      ).toBe("General");
    });
  });
});
