import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AdminPage, Route } from "@/routes/admin";
import { supabase } from "@/integrations/supabase/client";
import * as authModule from "@/lib/auth";

// Mock supabase client module
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

// Mock TanStack Router Link component
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ children, to, ...props }: any) => (
      <a href={typeof to === "string" ? to : "#"} {...props}>
        {children}
      </a>
    ),
  };
});

describe("Admin Route Authentication & Authorization Guards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated visitor to /admin-login", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);

    const beforeLoad = Route.options.beforeLoad as any;
    await expect(beforeLoad()).rejects.toMatchObject({
      options: {
        to: "/admin-login",
      },
    });
  });

  it("redirects authenticated user without admin/officer roles to /admin-login?denied=1", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user-456", email: "citizen@example.com" } },
      error: null,
    } as any);

    vi.spyOn(authModule, "fetchMyRoles").mockResolvedValue([]);

    const beforeLoad = Route.options.beforeLoad as any;
    await expect(beforeLoad()).rejects.toMatchObject({
      options: {
        to: "/admin-login",
        search: { denied: 1 },
      },
    });
  });

  it("grants access to authorized officer and returns security context", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "officer-789", email: "pwd.officer@roadtrack.gov.in" } },
      error: null,
    } as any);

    vi.spyOn(authModule, "fetchMyRoles").mockResolvedValue(["pwd_officer"]);

    const beforeLoad = Route.options.beforeLoad as any;
    const context = await beforeLoad();

    expect(context).toEqual({
      roles: ["pwd_officer"],
      adminEmail: "pwd.officer@roadtrack.gov.in",
      userId: "officer-789",
    });
  });
});

describe("Admin Dashboard Visual & Functional Layout", () => {
  const defaultTestContext = {
    roles: ["central_admin"] as authModule.AppRole[],
    adminEmail: "superadmin@roadtrack.gov.in",
    userId: "00000000-0000-0000-0000-000000000001",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    // Simulate unmigrated Supabase database: returns error when querying complaints table
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      return {
        select: () => ({
          in: () => ({
            order: () => Promise.resolve({ data: null, error: { message: `relation "public.${table}" does not exist` } }),
          }),
          order: () => Promise.resolve({ data: null, error: { message: `relation "public.${table}" does not exist` } }),
        }),
      } as any;
    });
  });

  it("displays migration-pending banner with clear offline disclaimer and DemoBadge", async () => {
    render(<AdminPage testContext={defaultTestContext} />);

    await waitFor(() => {
      expect(screen.getByText(/Database Migration Pending/i)).toBeInTheDocument();
    });

    // Check project ref in alert
    expect(screen.getByText(/mmhvsookdbjkrvplvvwo/i)).toBeInTheDocument();

    // Check clear disclaimer that records are offline prototype data
    expect(
      screen.getByText(/The records displayed below are offline demo prototype data for layout inspection only/i)
    ).toBeInTheDocument();

    // Check offline indicator
    expect(screen.getByText(/Demo \/ Prototype Data/i)).toBeInTheDocument();
  });

  it("renders overview KPI summary cards", async () => {
    render(<AdminPage testContext={defaultTestContext} />);

    await waitFor(() => {
      expect(screen.getByText("Total Complaints")).toBeInTheDocument();
      expect(screen.getByText("Pending Review")).toBeInTheDocument();
      expect(screen.getByText("Under Review")).toBeInTheDocument();
      expect(screen.getByText("In Progress")).toBeInTheDocument();
      expect(screen.getByText("Resolved Issues")).toBeInTheDocument();
    });
  });

  it("switches tabs between Overview, Complaints, Road Projects, and Jurisdiction & RLS", async () => {
    render(<AdminPage testContext={defaultTestContext} />);

    await waitFor(() => {
      expect(screen.getByText("Total Complaints")).toBeInTheDocument();
    });

    // Click Complaints tab
    const complaintsTab = screen.getByRole("button", { name: /Complaints/i });
    fireEvent.click(complaintsTab);
    expect(screen.getByText("Complaint Management Registry")).toBeInTheDocument();
    expect(screen.getByText("(Offline Demo Preview)")).toBeInTheDocument();

    // Click Road Projects tab
    const projectsTab = screen.getByRole("button", { name: /Road Projects/i });
    fireEvent.click(projectsTab);
    expect(screen.getByText("Infrastructure Road Projects Registry")).toBeInTheDocument();

    // Click Jurisdiction & RLS tab
    const securityTab = screen.getByRole("button", { name: /Jurisdiction & RLS/i });
    fireEvent.click(securityTab);
    expect(screen.getByText("PostgreSQL Row-Level Security Architecture")).toBeInTheDocument();
    expect(screen.getByText("Active Security Invariants")).toBeInTheDocument();
  });

  it("filters complaints using search bar and status dropdown", async () => {
    render(<AdminPage testContext={defaultTestContext} />);

    // Go to Complaints tab
    const complaintsTab = screen.getByRole("button", { name: /Complaints/i });
    fireEvent.click(complaintsTab);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search ID, location, details…/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search ID, location, details…/i);
    fireEvent.change(searchInput, { target: { value: "Kolar" } });

    // Should filter table to show the matched ID
    expect(screen.getByText("RT-DEMO-261002-K7P2Q")).toBeInTheDocument();
  });

  it("opens review modal and strictly enforces allowed status transition options matching SQL state machine", async () => {
    render(<AdminPage testContext={defaultTestContext} />);

    // Switch to Complaints tab
    fireEvent.click(screen.getByRole("button", { name: /Complaints/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Review \/ Update/i }).length).toBeGreaterThan(0);
    });

    // Open review modal for first complaint (which is "In Progress")
    const reviewButtons = screen.getAllByRole("button", { name: /Review \/ Update/i });
    fireEvent.click(reviewButtons[0]);

    // Modal should be open
    expect(screen.getByText(/Status Transition & Officer Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidential Investigation Data/i)).toBeInTheDocument();

    // Check status dropdown options
    const statusSelect = screen.getByLabelText(/New Workflow Status/i) as HTMLSelectElement;
    expect(statusSelect).toBeInTheDocument();

    // The options in the select must match allowed statuses for an "In Progress" complaint:
    // In Progress (Current), Resolved, Under Review
    const options = Array.from(statusSelect.options).map((o) => o.value);
    expect(options).toContain("In Progress");
    expect(options).toContain("Resolved");
    expect(options).toContain("Under Review");
    expect(options).not.toContain("Submitted");
  });

  it("validates mandatory public note and minimum 5-character resolution summary", async () => {
    render(<AdminPage testContext={defaultTestContext} />);

    // Switch to Complaints tab
    fireEvent.click(screen.getByRole("button", { name: /Complaints/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Review \/ Update/i }).length).toBeGreaterThan(0);
    });

    // Open review modal for first complaint (In Progress)
    fireEvent.click(screen.getAllByRole("button", { name: /Review \/ Update/i })[0]);

    const submitBtn = screen.getByRole("button", { name: /Confirm Status Transition/i });

    // 1. Empty public note -> rejection
    fireEvent.click(submitBtn);
    expect(screen.getByText(/A public note \(minimum 3 characters\) is required/i)).toBeInTheDocument();

    // Provide a valid public note
    const publicNoteInput = screen.getByPlaceholderText(/e\.g\. Field inspection scheduled/i);
    fireEvent.change(publicNoteInput, { target: { value: "Inspection scheduled for Monday morning." } });

    // 2. Select Resolved with empty resolution summary -> rejection
    const statusSelect = screen.getByLabelText(/New Workflow Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "Resolved" } });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/A public resolution summary \(minimum 5 characters\) is required when marking a complaint as Resolved/i)
    ).toBeInTheDocument();

    // 3. Fill in at least 5 characters for resolution summary
    const resSummaryInput = screen.getByPlaceholderText(/e\.g\. Road surface patched/i);
    fireEvent.change(resSummaryInput, { target: { value: "Road repaved and inspected on site." } });

    // Submit valid Resolved update
    fireEvent.click(submitBtn);

    // Should succeed in local demo store
    await waitFor(() => {
      expect(screen.getByText(/Status updated to "Resolved" in local demo store/i)).toBeInTheDocument();
    });
  });

  it("enforces departmental isolation: PWD officer sees only State PWD projects and cannot access invitation issuance", async () => {
    const pwdOfficerContext = {
      roles: ["pwd_officer"] as authModule.AppRole[],
      adminEmail: "officer@pwd.gov.in",
      userId: "00000000-0000-0000-0000-000000000002",
    };

    render(<AdminPage testContext={pwdOfficerContext} />);

    await waitFor(() => {
      expect(screen.getByText("Total Complaints")).toBeInTheDocument();
    });

    // Switch to Road Projects tab
    const projectsTab = screen.getByRole("button", { name: /Road Projects/i });
    fireEvent.click(projectsTab);

    // PWD projects should be visible
    expect(screen.getByText("Kolar–Ratibad Link Road Widening")).toBeInTheDocument();

    // NHAI and PMGSY projects must NOT be visible to PWD officer
    expect(screen.queryByText("NH-X Bypass Four-Laning (Package 2)")).not.toBeInTheDocument();
    expect(screen.queryByText("Village Connectivity Road – Khajuri to Barkheda")).not.toBeInTheDocument();

    // Switch to Jurisdiction & RLS tab
    const securityTab = screen.getByRole("button", { name: /Jurisdiction & RLS/i });
    fireEvent.click(securityTab);

    // Central Admin only invitation generator must NOT be present
    expect(screen.queryByText(/Officer Invitation & Role Provisioning/i)).not.toBeInTheDocument();
  });

  it("allows Central Admin to generate one-time officer invitation codes", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        success: true,
        invitation_code: "RT-INV-261011-9F3A1B2C",
        email: "new.officer@nhai.gov.in",
        role: "nhai_officer",
        department: "NHAI",
        message: "Invitation generated successfully",
      },
      error: null,
    } as any);

    render(<AdminPage testContext={defaultTestContext} />);

    await waitFor(() => {
      expect(screen.getByText("Total Complaints")).toBeInTheDocument();
    });

    // Switch to Jurisdiction & RLS tab
    const securityTab = screen.getByRole("button", { name: /Jurisdiction & RLS/i });
    fireEvent.click(securityTab);

    // Invitation issuance panel should be visible to Central Admin
    expect(screen.getByText(/Officer Invitation & Role Provisioning/i)).toBeInTheDocument();

    // Fill in officer email
    const emailInput = screen.getByPlaceholderText("officer@department.gov.in");
    fireEvent.change(emailInput, { target: { value: "new.officer@nhai.gov.in" } });

    // Submit form
    const generateBtn = screen.getByRole("button", { name: /Generate Activation Code/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("create_admin_invitation", {
        p_email: "new.officer@nhai.gov.in",
        p_role: "pwd_officer",
        p_expires_days: 7,
      });
      expect(screen.getByText("RT-INV-261011-9F3A1B2C")).toBeInTheDocument();
      expect(screen.getByText(/One-Time Officer Activation Code Generated/i)).toBeInTheDocument();
    });
  });
});

