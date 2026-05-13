import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";

export type AppRole = "owner" | "admin" | "manager" | "member" | "viewer";
export type NutrirCargo =
  | "diretor"
  | "gerente_regional"
  | "rtv"
  | "consultor"
  | "financeiro"
  | "logistica"
  | "cliente"
  | string;

export interface UserRoleInfo {
  loading: boolean;
  role: AppRole | null;
  cargo: NutrirCargo | null;
  isAdmin: boolean;          // owner | admin
  isManager: boolean;        // gerente_regional ou manager
  isRtv: boolean;            // cargo rtv
  isViewer: boolean;         // viewer (cliente)
  isDirector: boolean;       // diretor
}

export function useUserRole(): UserRoleInfo {
  const { user } = useAuth();
  const { current } = useOrg();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [cargo, setCargo] = useState<NutrirCargo | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user || !current) {
        if (active) { setRole(null); setCargo(null); setLoading(false); }
        return;
      }
      setLoading(true);
      const [{ data: mem }, { data: col }] = await Promise.all([
        (supabase as any)
          .from("organization_members")
          .select("role")
          .eq("organization_id", current.id)
          .eq("user_id", user.id)
          .maybeSingle(),
        (supabase as any)
          .from("nutrir_colaboradores")
          .select("cargo")
          .eq("organization_id", current.id)
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle(),
      ]);
      if (!active) return;
      setRole((mem?.role as AppRole) ?? null);
      setCargo((col?.cargo as NutrirCargo) ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id, current?.id]);

  const isAdmin = role === "owner" || role === "admin";
  const isManager = role === "manager" || cargo === "gerente_regional";
  const isRtv = cargo === "rtv";
  const isViewer = role === "viewer";
  const isDirector = cargo === "diretor" || isAdmin;

  return { loading, role, cargo, isAdmin, isManager, isRtv, isViewer, isDirector };
}
