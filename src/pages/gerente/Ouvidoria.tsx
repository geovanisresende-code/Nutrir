import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertOctagon, AlertTriangle, Info, MessageSquare, Check, Search, Clock, Filter } from "lucide-react";
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
  const [statusFiltro, setStatusFiltro] = useState<"ativos" | Status>("ativos");
  const [busca, setBusca] = useState("");
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
    toast({ title: "Alerta fechado" });
    load();
  };

  const marcarEmAnalise = async (id: string) => {
    await (supabase as any).from("nutrir_ouvidoria").update({ status: "em_analise" }).eq("id", id);
    toast({ title: "Marcado como em análise" });
    load();
  };

  const filtered = useMemo(() => {
    let list = items;
    // filtro nivel (tab)
    if (tab !== "todos") list = list.filter(i => i.nivel === tab);
    // filtro status
    if (statusFiltro === "ativos") list = list.filter(i => i.status !== "fechado");
    else list = list.filter(i => i.status === statusFiltro);
    // busca
    if (busca.trim()) {
      const b = busca.toLowerCase();
      list = list.filter(i =>
        i.titulo.toLowerCase().includes(b) ||
        i.mensagem.toLowerCase().includes(b) ||
        (i.cliente_nome_livre ?? "").toLowerCase().includes(b)
      );
    }
    return list;
  }, [items, tab, statusFiltro, busca]);

  const count = (n: Nivel) => items.filter(i => i.nivel === n && i.status !== "fechado").length;
  const urgentesAbertas = items.filter(i => i.nivel === "muito_urgente" && i.status === "aberto").length;
  const emAnalise = items.filter(i => i.status === "em_analise").length;
  const respondidos = items.filter(i => i.status === "respondido").length;
  const totalAtivos = items.filter(i => i.status !== "fechado").length;

  const nivelBadge = (n: Nivel) => {
    if (n === "muito_urgente") return <Badge variant="destructive"><AlertOctagon className="w-3 h-3 mr-1"/>Muito Urgente</Badge>;
    if (n === "ponto_atencao") return <Badge className="bg-yellow-500 text-black hover:bg-yellow-600"><AlertTriangle className="w-3 h-3 mr-1"/>Atenção</Badge>;
    return <Badge variant="secondary"><Info className="w-3 h-3 mr-1"/>Rotina</Badge>;
  };

  const statusBadge = (s: Status) => {
    const configs: Record<Status, { label: string; cls: string }> = {
      aberto:      { label: "Aberto",      cls: "border-red-300 text-red-700" },
      em_analise:  { label: "Em análise",  cls: "border-blue-300 text-blue-700" },
      respondido:  { label: "Respondido",  cls: "border-green-300 text-green-700" },
      fechado:     { label: "Fechado",     cls: "border-muted text-muted-foreground" },
    };
    const cfg = configs[s];
    return <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Ouvidoria" description="Alertas e relatos enviados pelos representantes" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={urgentesAbertas > 0 ? "border-destructive" : ""}><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertOctagon className="h-3.5 w-3.5 text-destructive" /> Urgentes abertas</div>
          <div className={`text-2xl font-bold ${urgentesAbertas > 0 ? "text-destructive" : ""}`}>{urgentesAbertas}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-blue-500" /> Em análise</div>
          <div className="text-2xl font-bold text-blue-600">{emAnalise}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-500" /> Respondidos</div>
          <div className="text-2xl font-bold text-green-600">{respondidos}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total ativos</div>
          <div className="text-2xl font-bold">{totalAtivos}</div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" className="pl-8 h-8 w-52" />
        </div>
        <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as any)}>
          <SelectTrigger className="h-8 w-40">
            <Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos (excl. fechados)</SelectItem>
            <SelectItem value="aberto">Abertos</SelectItem>
            <SelectItem value="em_analise">Em análise</SelectItem>
            <SelectItem value="respondido">Respondidos</SelectItem>
            <SelectItem value="fechado">Fechados</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} resultado(s)</span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({totalAtivos})</TabsTrigger>
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
                      <div className="flex gap-2 flex-wrap">
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
                        {i.respondido_em && (
                          <div className="text-[10px] text-muted-foreground mt-1">{new Date(i.respondido_em).toLocaleString("pt-BR")}</div>
                        )}
                      </div>
                    )}
                    {i.status !== "fechado" && (
                      <div className="space-y-2 pt-2 border-t">
                        <Textarea rows={2} placeholder="Resposta ao representante…"
                          value={resposta[i.id] ?? ""} onChange={e => setResposta(r => ({ ...r, [i.id]: e.target.value }))} />
                        <div className="flex gap-2 justify-end flex-wrap">
                          {i.status === "aberto" && (
                            <Button variant="outline" size="sm" onClick={() => marcarEmAnalise(i.id)}>
                              <Clock className="w-3.5 h-3.5 mr-1"/>Em análise
                            </Button>
                          )}
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
