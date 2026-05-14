import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCircle, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";
import { usePosition } from "@/hooks/usePosition";
import { POSITION_LABEL, type Position } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";

/*
  Banner discreto mostrando quem está logado e em qual regional —
  pra deixar claro nas telas de Visita / RDV / Pedido quem é o vendedor
  responsável pelo registro.
*/
export default function VendedorBadge() {
  const { user } = useAuth();
  const { current } = useOrg();
  const { position } = usePosition();
  const [nome, setNome] = useState("");
  const [regional, setRegional] = useState("");

  useEffect(() => {
    if (!user || !current) return;
    (async () => {
      // Tenta achar o nome do representante / colaborador
      const { data: col } = await (supabase as any)
        .from("nutrir_colaboradores")
        .select("nome, regional:nutrir_regionais(nome)")
        .eq("organization_id", current.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (col) {
        setNome(col.nome ?? user.email ?? "—");
        setRegional(col.regional?.nome ?? "");
        return;
      }
      // Fallback pro profile
      const { data: p } = await (supabase as any)
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setNome(p?.full_name ?? user.email ?? "—");
    })();
  }, [user?.id, current?.id]);

  return (
    <Card className="mb-3 bg-gradient-to-r from-primary/5 via-background to-background border-primary/20">
      <CardContent className="py-2 px-3 flex items-center gap-3 text-sm">
        <UserCircle className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{nome || user?.email}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {position ? POSITION_LABEL[position as Position] : "Colaborador"}
            </Badge>
            {regional && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{regional}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
