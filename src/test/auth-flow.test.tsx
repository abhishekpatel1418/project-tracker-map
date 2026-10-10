import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { Route as LoginRoute } from "@/routes/login";
import { Route as AdminLoginRoute } from "@/routes/admin-login";
import { supabase } from "@/integrations/supabase/client";
import * as authModule from "@/lib/auth";

const mockNavigate = vi.fn();

// Mock supabase client module
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        resend: vi.fn(),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      rpc: vi.fn(),
    },
  };
});

// Mock auth session hook
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useSession: () => ({ session: null, ready: true }),
    fetchMyRoles: vi.fn().mockResolvedValue([]),
  };
});

// Mock TanStack Router
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => ({}),
    Link: ({ children, to, ...props }: any) => (
      <a href={typeof to === "string" ? to : "#"} {...props}>
        {children}
      </a>
    ),
  };
});

describe("Citizen Auth & Email Verification Flow", () => {
  const LoginPage = LoginRoute.options.component!;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  it("shows confirmation message after successful signup when email confirmation is required", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: "user-123", email: "citizen@example.com" }, session: null },
      error: null,
    } as any);

    render(<LoginPage />);

    // Switch to Sign Up mode
    const signUpTab = screen.getByRole("button", { name: "Sign Up" });
    fireEvent.click(signUpTab);

    // Fill in signup form
    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInputs = screen.getAllByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: "citizen@example.com" } });
    fireEvent.change(passwordInputs[0], { target: { value: "secure123" } });
    fireEvent.change(passwordInputs[1], { target: { value: "secure123" } });

    // Submit form (second button with 'Sign Up' name is the submit button)
    const submitBtn = screen.getAllByRole("button", { name: "Sign Up" })[1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Check citizen@example\.com for a confirmation link, then log in\./i)).toBeInTheDocument();
    });
  });

  it("validates email before allowing resend verification email", async () => {
    render(<LoginPage />);

    const resendBtn = screen.getByRole("button", { name: /Resend verification email/i });
    fireEvent.click(resendBtn);

    expect(screen.getByText(/Enter a valid email address first\./i)).toBeInTheDocument();
    expect(supabase.auth.resend).not.toHaveBeenCalled();
  });

  it("successfully calls supabase.auth.resend with type 'signup' and displays success confirmation", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: "citizen@example.com" } });

    const resendBtn = screen.getByRole("button", { name: /Resend verification email/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "citizen@example.com",
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      expect(screen.getByText(/Verification link resent to citizen@example\.com/i)).toBeInTheDocument();
    });
  });

  it("handles and displays error when resend verification email fails", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: null,
      error: { message: "For security purposes, you can only request this once every 60 seconds." },
    } as any);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: "citizen@example.com" } });

    const resendBtn = screen.getByRole("button", { name: /Resend verification email/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(screen.getByText(/For security purposes, you can only request this once every 60 seconds\./i)).toBeInTheDocument();
    });
  });

  it("redirects citizen to landing page on successful login", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "user-123", email: "citizen@example.com" }, session: {} },
      error: null,
    } as any);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    fireEvent.change(emailInput, { target: { value: "citizen@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    const loginSubmitBtn = screen.getAllByRole("button", { name: "Login" })[1];
    fireEvent.click(loginSubmitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("displays clear unconfirmed email message when sign-in fails due to unconfirmed email", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email not confirmed" },
    } as any);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    fireEvent.change(emailInput, { target: { value: "citizen@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    const loginSubmitBtn = screen.getAllByRole("button", { name: "Login" })[1];
    fireEvent.click(loginSubmitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Your email address has not been confirmed yet/i)).toBeInTheDocument();
    });
  });
});

describe("Admin Auth & Authorization Flow", () => {
  const AdminLoginPage = AdminLoginRoute.options.component!;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  it("redirects authorized admin to /admin after successful sign-in", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "admin-123", email: "officer@pwd.gov.in" }, session: {} },
      error: null,
    } as any);

    vi.mocked(authModule.fetchMyRoles).mockResolvedValue(["pwd_officer"]);

    render(<AdminLoginPage />);

    const userIdInput = screen.getByLabelText(/User ID/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    fireEvent.change(userIdInput, { target: { value: "officer@pwd.gov.in" } });
    fireEvent.change(passwordInput, { target: { value: "adminPass123" } });

    const submitBtn = screen.getByRole("button", { name: /Sign in to Admin Portal/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin" });
    });
  });

  it("denies access to citizen account without roles and signs them out", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "citizen-456", email: "citizen@gmail.com" }, session: {} },
      error: null,
    } as any);

    vi.mocked(authModule.fetchMyRoles).mockResolvedValue([]);

    render(<AdminLoginPage />);

    const userIdInput = screen.getByLabelText(/User ID/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    fireEvent.change(userIdInput, { target: { value: "citizen@gmail.com" } });
    fireEvent.change(passwordInput, { target: { value: "citizenPass123" } });

    const submitBtn = screen.getByRole("button", { name: /Sign in to Admin Portal/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin" });
    });
  });

  describe("Admin Activation Flow with One-Time Invitation Code", () => {
    it("validates code length before attempting activation", async () => {
      render(<AdminLoginPage />);
      fireEvent.click(screen.getByRole("button", { name: "Activate Account" }));

      const userIdInput = screen.getByLabelText(/Official User ID/i);
      const passwordInput = screen.getByLabelText(/Password/i);
      const codeInput = screen.getByLabelText(/One-Time Activation Code/i);

      fireEvent.change(userIdInput, { target: { value: "officer@pwd.gov.in" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.change(codeInput, { target: { value: "SHORT" } });

      const submitBtn = screen.getByRole("button", { name: /Redeem Code & Activate Role/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Enter a valid One-Time Admin Activation Code/i)).toBeInTheDocument();
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("activates officer account and redirects on valid invitation code", async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: { id: "officer-new", email: "officer@pwd.gov.in" }, session: {} },
        error: null,
      } as any);

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: {
          success: true,
          role: "pwd_officer",
          department: "State PWD",
          message: "Account activated successfully",
        },
        error: null,
      } as any);

      render(<AdminLoginPage />);
      fireEvent.click(screen.getByRole("button", { name: "Activate Account" }));

      const userIdInput = screen.getByLabelText(/Official User ID/i);
      const passwordInput = screen.getByLabelText(/Password/i);
      const codeInput = screen.getByLabelText(/One-Time Activation Code/i);

      fireEvent.change(userIdInput, { target: { value: "officer@pwd.gov.in" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.change(codeInput, { target: { value: "RT-INV-261011-A1B2C3D4" } });

      const submitBtn = screen.getByRole("button", { name: /Redeem Code & Activate Role/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith("activate_admin_invitation", {
          p_invitation_code: "RT-INV-261011-A1B2C3D4",
        });
        expect(screen.getByText(/Officer account activated successfully! Assigned role: pwd_officer/i)).toBeInTheDocument();
      });
    });

    it("displays error when activation code is invalid, expired, or already claimed", async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: { id: "officer-new", email: "officer@pwd.gov.in" }, session: {} },
        error: null,
      } as any);

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: {
          success: false,
          error: "INVITATION_EXPIRED",
          message: "Invitation code has expired or was already claimed.",
        },
        error: null,
      } as any);

      render(<AdminLoginPage />);
      fireEvent.click(screen.getByRole("button", { name: "Activate Account" }));

      const userIdInput = screen.getByLabelText(/Official User ID/i);
      const passwordInput = screen.getByLabelText(/Password/i);
      const codeInput = screen.getByLabelText(/One-Time Activation Code/i);

      fireEvent.change(userIdInput, { target: { value: "officer@pwd.gov.in" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.change(codeInput, { target: { value: "RT-INV-261011-EXPIRED1" } });

      const submitBtn = screen.getByRole("button", { name: /Redeem Code & Activate Role/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Invitation code has expired or was already claimed/i)).toBeInTheDocument();
      });
    });
  });
});

