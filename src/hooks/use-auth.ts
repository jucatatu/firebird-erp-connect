import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type AppRole = "admin" | "vendedor" | "aprovador";

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null as User | null, loading };
}

export function useMyRoles(user: User | null) {
  return useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useMyProfile(user: User | null) {
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, active, erp_seller_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function primaryRole(roles: AppRole[] | undefined): AppRole | null {
  if (!roles || roles.length === 0) return null;
  if (roles.includes("admin")) return "admin";
  if (roles.includes("aprovador")) return "aprovador";
  if (roles.includes("vendedor")) return "vendedor";
  return roles[0];
}

export function useMyCompanies(user: User | null) {
  return useQuery({
    queryKey: ["my-companies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_company_access")
        .select("company_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((c) => c.company_id);
    },
  });
}