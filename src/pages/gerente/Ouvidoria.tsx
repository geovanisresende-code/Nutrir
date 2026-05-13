import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertOctagon, AlertTriangle, Info, MessageSquare, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/layout/AppShell";

type Nivel = "muito_urgente" | "ponto_atencao" | "relato_rotina";
type Status = "aberto" | "em_analise" | "respondido" | "fechado";

interface Item {
  id: string; user_id: string; cliente_id: string | null; cliente_nome_livre: string | null;
  nivel: Nivel; status: Status; titulo: string; mensagem: string;
  resposta: string | null; respondido_em: string | null; created_at: string;
}

export default function Ouvidoria() {
  const { current } = useOrg();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"todos" | Nivel>("todos");
  const [resposta, setResposta] = useState<Record<string,string>>({});

  const load = async () => {
    if (!current) return;
    setLoading(true);
    const { data } = await (supabase as any).from("nutrir_ouvidoria")
      .select("*").eq("organization_id", current.id).order("created_at", { ascending: false });
    setItems((data ?? []) as Item[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  const responder = async (id: string) => {
    const txt = (resposta[id] || "").trim();
    if (!txt) { toast({ title: "Escreva uma resposta", variant: "destructive" }); return; }
    const { error } = await (supabase as any).from("nutrir_ouvidoria").update({
      resposta: txt, respondido_por: user?.id, respondido_em: new Date().toISOString(), status: "respondido",
    }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Resposta enviada" });
    setResposta(r => ({ ...r, [id]: "" }));
    load();
  };

  const fechar = async (id: string) => {
    await (supabase as any).from("nutrir_ouvidoria").update({ status: "fechado" }).eq("id", id);
    load();
  };

  const filtered = items.filter(i => tab === "todos" || i.nivel === tab);
  const count = (n: Nivel) => items.filter(i => i.nivel === n && i.status !== "fechado").length;

  const nivelBadge = (n: Nivel) => {
    if (n === "muito_urgente") return <Badge variant="destructive"><AlertOctagon className="w-3 h-3 mr-1"/>Muito Urgente</Badge>;
    if (n === "ponto_atencao") return <Badge className="bg-yellow-500 text-black hover:bg-yellow-600"><AlertTriangle className="w-3 h-3 mr-1"/>Atenção</Badge>;
    return <Badge variant="secondary"><Info className="w-3 h-3 mr-1"/>Rotina</Badge>;
  };
  const statusBadge = (s: Status) => {
    const map: Record<Status, string> = { aberto: "Aberto", em_analise: "Em análise", respondido: "Respondido", fechado: "Fechado" };
    return <Badge variant="outline">{map[s]}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Ouvidoria" description="Alertas e relatos enviados pelos representantes" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({items.filter(i => i.status !== "fechado").length})</TabsTrigger>
          <TabsTrigger value="muito_urgente" className="text-destructive">Urgentes ({count("muito_urgente")})</TabsTrigger>
          <TabsTrigger value="ponto_atencao">Atenção ({count("ponto_atencao")})</TabsTrigger>
          <TabsTrigger value="relato_rotina">Rotina ({count("relato_rotina")})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              Sem registros nesta categoria.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(i => (
                <Card key={i.id} className={i.nivel === "muito_urgente" && i.status === "aberto" ? "border-destructive" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <CardTitle className="text-base">{i.titulo}</CardTitle>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(i.created_at).toLocaleString("pt-BR")} ·{" "}
                          {i.cliente_nome_livre || "Cliente vinculado"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {nivelBadge(i.nivel)}
                        {statusBadge(i.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <p className="whitespace-pre-wrap">{i.mensagem}</p>
                    {i.resposta && (
                      <div className="bg-muted/50 rounded p-3 border-l-2 border-primary">
                        <div className="text-xs font-semibold mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3"/>Resposta:</div>
                        <p className="whitespace-pre-wrap">{i.resposta}</p>
                      </div>
                    )}
                    {i.status !== "fechado" && (
                      <div className="space-y-2 pt-2 border-t">
                        <Textarea rows={2} placeholder="Resposta ao representante…"
                          value={resposta[i.id] ?? ""} onChange={e => setResposta(r => ({ ...r, [i.id]: e.target.value }))} />
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => fechar(i.id)}>
                            <Check className="w-4 h-4 mr-1"/>Fechar
                          </Button>
                          <Button size="sm" onClick={() => responder(i.id)}>Enviar resposta</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
