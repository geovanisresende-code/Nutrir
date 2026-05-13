import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";
import { can, type Capability, type Position } from "@/lib/permissions";

export function usePosition() {
  const { user } = useAuth();
  const { current } = useOrg();
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user || !current) { setPosition(null); setLoading(false); return; }
      setLoading(true);
      // 1) tenta user_positions
      const { data: pos } = await (supabase as any)
        .from("user_positions").select("position")
        .eq("organization_id", current.id).eq("user_id", user.id).maybeSingle();

      let p: Position | null = (pos?.position as Position) ?? null;

      // 2) fallback: deriva de organization_members.role + cargo Nutrir
      if (!p) {
        const { data: mem } = await (supabase as any)
          .from("organization_members").select("role")
          .eq("organization_id", current.id).eq("user_id", user.id).maybeSingle();
        const role = mem?.role;
        if (current.owner_id === user.id || role === "owner") p = "proprietario";
        else if (role === "admin") p = "diretor";
        else if (role === "manager") p = "gerente";
        else if (role === "viewer") p = "cliente";
        else {
          const { data: col } = await (supabase as any)
            .from("nutrir_colaboradores").select("cargo")
            .eq("organization_id", current.id).eq("user_id", user.id).maybeSingle();
          if (col?.cargo === "rtv") p = "representante";
          else if (col?.cargo === "consultor") p = "assistente_tecnico";
          else if (col?.cargo === "gerente_regional") p = "gerente";
          else if (col?.cargo === "diretor") p = "diretor";
          else p = "cliente";
        }
      }

      if (!alive) return;
      setPosition(p);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id, current?.id]);

  return {
    loading,
    position,
    can: (cap: Capability) => can(position, cap),
  };
}
