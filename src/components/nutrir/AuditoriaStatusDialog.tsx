import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Registro {
  id: string;
  user_id: string | null;
  status_anterior: string | null;
  status_novo: string;
  motivo: string | null;
  created_at: string;
}

interface Props {
  entidade: "pedido" | "orcamento";
  entidadeId: string;
  titulo?: string;
}

export default function AuditoriaStatusDialog({ entidade, entidadeId, titulo }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("nutrir_auditoria_status")
        .select("id,user_id,status_anterior,status_novo,motivo,created_at")
        .eq("entidade", entidade)
        .eq("entidade_id", entidadeId)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [open, entidade, entidadeId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Histórico de status">
          <History className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Histórico de status {titulo ? `· ${titulo}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma alteração de status registrada.</p>
          ) : (
            rows.map(r => (
              <div key={r.id} className="border rounded-md p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.status_anterior && (
                    <>
                      <Badge variant="outline">{r.status_anterior}</Badge>
                      <span className="text-muted-foreground">→</span>
                    </>
                  )}
                  <Badge>{r.status_novo}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                  {r.user_id && <> · usuário <span className="font-mono">{r.user_id.slice(0, 8)}</span></>}
                </div>
                {r.motivo && <div className="text-xs italic text-muted-foreground">"{r.motivo}"</div>}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
