import { useEffect, useState } from "react";
import { redirect } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  central_admin: "Central Admin",
  pwd_officer: "State PWD Officer",
  nhai_officer: "NHAI Officer",
  pmgsy_officer: "PMGSY Officer",
};

/** Guard for protected user-facing routes: redirects unauthenticated users to /login. */
export async function requireAuth(ctx?: { location?: { pathname: string } }) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const target = ctx?.location?.pathname;
    throw redirect({
      to: "/login",
      search: target && target !== "/" ? { redirect: target } : undefined,
    });
  }
  return { session: data.session };
}

/** Roles come only from the protected user_roles table (readable by the owner, writable by no client). */
export async function fetchMyRoles(): Promise<AppRole[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  if (error) return [];
  return data.map((r) => r.role);
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}
