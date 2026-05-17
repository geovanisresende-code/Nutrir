import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Megaphone, Users, Target, TrendingUp, Search,
  CheckCircle2, XCircle, Clock, Pencil, Trash2, ChevronRight,
  CalendarDays, CloudRain, Thermometer, Wind, Sprout, Bell, AlertTriangle, RefreshCw,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// ─── Calendário agrícola — janelas de plantio por cultura e UF ───────────────
type JanelaPlantio = { cultura: string; uf: string; inicio_mes: number; fim_mes: number; estagios: string[] };
const CALENDARIO: JanelaPlantio[] = [
  // Soja — centro-oeste + sul
  { cultura: "Soja", uf: "MT",  inicio_mes: 10, fim_mes: 12, estagios: ["Plantio Out-Dez", "Colheita Fev-Mar"] },
  { cultura: "Soja", uf: "MS",  inicio_mes: 10, fim_mes: 12, estagios: ["Plantio Out-Dez", "Colheita Fev-Mar"] },
  { cultura: "Soja", uf: "GO",  inicio_mes: 10, fim_mes: 11, estagios: ["Plantio Out-Nov", "Colheita Jan-Fev"] },
  { cultura: "Soja", uf: "PR",  inicio_mes: 10, fim_mes: 12, estagios: ["Plantio Out-Dez", "Colheita Jan-Mar"] },
  { cultura: "Soja", uf: "RS",  inicio_mes: 10, fim_mes: 12, estagios: ["Plantio Out-Dez", "Colheita Jan-Mar"] },
  { cultura: "Soja", uf: "SP",  inicio_mes: 10, fim_mes: 11, estagios: ["Plantio Out-Nov", "Colheita Jan-Feb"] },
  // Milho 1ª safra
  { cultura: "Milho",  uf: "MT", inicio_mes: 2, fim_mes: 3, estagios: ["Safrinha Fev-Mar", "Colheita Jun-Jul"] },
  { cultura: "Milho",  uf: "PR", inicio_mes: 8, fim_mes: 9, estagios: ["1ª safra Ago-Set", "Colheita Jan-Fev"] },
  // Algodão
  { cultura: "Algodão", uf: "MT", inicio_mes: 12, fim_mes: 1, estagios: ["Plantio Dez-Jan", "Colheita Jun-Jul"] },
  { cultura: "Algodão", uf: "BA", inicio_mes: 12, fim_mes: 1, estagios: ["Plantio Dez-Jan", "Colheita Jun-Jul"] },
  // Café
  { cultura: "Café", uf: "MG", inicio_mes: 10, fim_mes: 12, estagios: ["Florada Set-Nov", "Maturação Jan-Jun"] },
  { cultura: "Café", uf: "SP", inicio_mes: 10, fim_mes: 12, estagios: ["Florada Set-Nov", "Maturação Jan-Jun"] },
  // Cana
  { cultura: "Cana",  uf: "SP", inicio_mes: 8, fim_mes: 11, estagios: ["Cana planta Ago-Nov", "Cana soca: contínuo"] },
];

// Retorna janelas com distância em meses para o mês atual
function janelaProxima(mesAtual: number, janela: JanelaPlantio): { distancia: number; emJanela: boolean } {
  const in_window = mesAtual >= janela.inicio_mes || mesAtual <= janela.fim_mes;
  const dist = janela.inicio_mes >= mesAtual ? janela.inicio_mes - mesAtual : (12 - mesAtual) + janela.inicio_mes;
  return { distancia: dist, emJanela: in_window || dist <= 1 };
}

// ─── tipos ───────────────────────────────────────────────────────────────────
type StatusCamp = "planejamento" | "ativa" | "pausada" | "encerrada";
type StatusLead = "novo" | "contatado" | "qualificado" | "convertido" | "perdido";

interface Campanha {
  id: string; nome: string; produto: string | null; regiao: string | null;
  status: StatusCamp; meta_leads: number; descricao: string | null;
  data_inicio: string | null; data_fim: string | null; created_at: string;
}

interface Lead {
  id: string; campanha_id: string; nome: string; telefone: string | null;
  email: string | null; cidade: string | null; area_ha: number | null;
  cultura: string | null; status: StatusLead; observacoes: string | null;
  created_at: string;
}

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── configs visuais ─────────────────────────────────────────────────────────
const STATUS_CAMP: Record<StatusCamp, { label: string; cls: string }> = {
  planejamento: { label: "Planejamento", cls: "border-slate-300 text-slate-600" },
  ativa:        { label: "Ativa",        cls: "border-green-400 text-green-700 bg-green-50" },
  pausada:      { label: "Pausada",      cls: "border-amber-300 text-amber-700" },
  encerrada:    { label: "Encerrada",    cls: "border-muted text-muted-foreground" },
};

const STATUS_LEAD: Record<StatusLead, { label: string; icon: any; cls: string }> = {
  novo:        { label: "Novo",        icon: Clock,         cls: "bg-slate-100 text-slate-700" },
  contatado:   { label: "Contatado",   icon: TrendingUp,    cls: "bg-blue-50 text-blue-700" },
  qualificado: { label: "Qualificado", icon: Target,        cls: "bg-amber-50 text-amber-700" },
  convertido:  { label: "Convertido",  icon: CheckCircle2,  cls: "bg-emerald-50 text-emerald-700" },
  perdido:     { label: "Perdido",     icon: XCircle,       cls: "bg-red-50 text-red-600" },
};

const ORDEM_LEAD: StatusLead[] = ["novo", "contatado", "qualificado", "convertido", "perdido"];

// ─── defaults formulário ──────────────────────────────────────────────────────
const CAMP_VAZIO: Partial<Campanha> = {
  nome: "", produto: "", regiao: "", status: "planejamento", meta_leads: 50,
  descricao: "", data_inicio: "", data_fim: "",
};
const LEAD_VAZIO: Partial<Lead> = {
  nome: "", telefone: "", email: "", cidade: "", area_ha: undefined,
  cultura: "", status: "novo", observacoes: "",
};

export default function GeracaoDemanda() {
  const { current } = useOrg();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);

  // estado UI
  const [campSel, setCampSel]   = useState<string | null>(null);
  const [busca, setBusca]       = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusLead | "todos">("todos");

  // diálogos
  const [openCamp, setOpenCamp] = useState(false);
  const [editCamp, setEditCamp] = useState<Partial<Campanha>>(CAMP_VAZIO);
  const [openLead, setOpenLead] = useState(false);
  const [editLead, setEditLead] = useState<Partial<Lead>>(LEAD_VAZIO);
  const [savingC, setSavingC]   = useState(false);
  const [savingL, setSavingL]   = useState(false);

  // ─── calendário & clima ───────────────────────────────────────────────────
  const [climaUF, setClimaUF] = useState("MT");
  const [climaLat, setClimaLat] = useState("-15.60");
  const [climaLng, setClimaLng] = useState("-56.10");
  const [climaData, setClimaData] = useState<any>(null);
  const [climaLoading, setClimaLoading] = useState(false);
  const [alertas, setAlertas] = useState<{ tipo: string; mensagem: string; urgencia: "alta" | "media" | "baixa" }[]>([]);

  const buscarClima = async () => {
    setClimaLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${climaLat}&longitude=${climaLng}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max&forecast_days=7&timezone=America/Sao_Paulo`;
      const res = await fetch(url);
      const json = await res.json();
      setClimaData(json.daily);

      // Gerar alertas preditivos baseados em clima + leads
      const novosAlertas: typeof alertas = [];
      const mesAtual = new Date().getMonth() + 1;

      // Alerta de chuva excessiva
      const chuvaTotal = (json.daily?.precipitation_sum ?? []).reduce((a: number, b: number) => a + (b ?? 0), 0);
      if (chuvaTotal > 80) {
        novosAlertas.push({ tipo: "Chuva excessiva", mensagem: `${chuvaTotal.toFixed(0)} mm previstos nos próximos 7 dias — agendar visitas técnicas antes da janela chuvosa.`, urgencia: "alta" });
      } else if (chuvaTotal < 10) {
        novosAlertas.push({ tipo: "Seca severa", mensagem: `Apenas ${chuvaTotal.toFixed(0)} mm previstos — produtores precisam de suporte em estresse hídrico.`, urgencia: "media" });
      }

      // Alertas de janela de plantio
      const culturasAtivas = new Set(leads.map(l => l.cultura).filter(Boolean));
      for (const janela of CALENDARIO) {
        if (janela.uf !== climaUF && climaUF !== "Todos") continue;
        const { distancia, emJanela } = janelaProxima(mesAtual, janela);
        if (emJanela && culturasAtivas.has(janela.cultura)) {
          novosAlertas.push({
            tipo: `${janela.cultura} em ${janela.uf}`,
            mensagem: `Janela de plantio ABERTA para ${janela.cultura} em ${janela.uf}. ${janela.estagios.join(" · ")}. ${leads.filter(l => l.cultura === janela.cultura).length} leads com esta cultura — contato prioritário!`,
            urgencia: "alta",
          });
        } else if (distancia <= 2 && culturasAtivas.has(janela.cultura)) {
          novosAlertas.push({
            tipo: `${janela.cultura} em ${janela.uf}`,
            mensagem: `Janela de plantio de ${janela.cultura} abre em ~${distancia} mês(es). Iniciar abordagem comercial com ${leads.filter(l => l.cultura === janela.cultura).length} leads.`,
            urgencia: "media",
          });
        }
      }

      // Alerta de leads não contatados há mais de 7 dias
      const agora = new Date();
      const leadsParados = leads.filter(l => {
        if (l.status === "convertido" || l.status === "perdido") return false;
        const dt = new Date(l.created_at);
        return (agora.getTime() - dt.getTime()) > 7 * 86_400_000;
      });
      if (leadsParados.length > 0) {
        novosAlertas.push({
          tipo: "Leads sem atividade",
          mensagem: `${leadsParados.length} lead(s) sem movimentação há mais de 7 dias. Agendar retorno imediato.`,
          urgencia: "media",
        });
      }

      setAlertas(novosAlertas);
      toast({ title: "Clima e alertas atualizados" });
    } catch (e: any) {
      toast({ title: "Erro ao buscar clima", description: e.message, variant: "destructive" });
    } finally { setClimaLoading(false); }
  };

  // ─── load ─────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!current) return;
    setLoading(true);
    const [{ data: c }, { data: l }] = await Promise.all([
      (supabase as any).from("nutrir_campanhas").select("*").eq("organization_id", current.id).order("created_at", { ascending: false }),
      (supabase as any).from("nutrir_leads").select("*").eq("organization_id", current.id).order("created_at", { ascending: false }),
    ]);
    setCampanhas(c ?? []);
    setLeads(l ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  // ─── salvar campanha ──────────────────────────────────────────────────────
  const salvarCamp = async () => {
    if (!current || !editCamp.nome) {
      toast({ title: "Nome obrigatório", variant: "destructive" }); return;
    }
    setSavingC(true);
    const payload = {
      organization_id: current.id,
      nome: editCamp.nome, produto: editCamp.produto || null,
      regiao: editCamp.regiao || null, status: editCamp.status ?? "planejamento",
      meta_leads: Number(editCamp.meta_leads) || 50,
      descricao: editCamp.descricao || null,
      data_inicio: editCamp.data_inicio || null,
      data_fim: editCamp.data_fim || null,
    };
    if (editCamp.id) {
      await (supabase as any).from("nutrir_campanhas").update(payload).eq("id", editCamp.id);
    } else {
      await (supabase as any).from("nutrir_campanhas").insert(payload);
    }
    toast({ title: "Campanha salva" });
    setOpenCamp(false); setEditCamp(CAMP_VAZIO); setSavingC(false); load();
  };

  const deletarCamp = async (id: string) => {
    if (!confirm("Excluir campanha e todos os seus leads?")) return;
    await (supabase as any).from("nutrir_leads").delete().eq("campanha_id", id);
    await (supabase as any).from("nutrir_campanhas").delete().eq("id", id);
    if (campSel === id) setCampSel(null);
    toast({ title: "Campanha excluída" }); load();
  };

  // ─── salvar lead ──────────────────────────────────────────────────────────
  const salvarLead = async () => {
    if (!current || !editLead.nome || !campSel) {
      toast({ title: "Nome obrigatório", variant: "destructive" }); return;
    }
    setSavingL(true);
    const payload = {
      organization_id: current.id, campanha_id: campSel,
      nome: editLead.nome, telefone: editLead.telefone || null,
      email: editLead.email || null, cidade: editLead.cidade || null,
      area_ha: editLead.area_ha ? Number(editLead.area_ha) : null,
      cultura: editLead.cultura || null, status: editLead.status ?? "novo",
      observacoes: editLead.observacoes || null,
    };
    if (editLead.id) {
      await (supabase as any).from("nutrir_leads").update(payload).eq("id", editLead.id);
    } else {
      await (supabase as any).from("nutrir_leads").insert(payload);
    }
    toast({ title: "Lead salvo" });
    setOpenLead(false); setEditLead(LEAD_VAZIO); setSavingL(false); load();
  };

  const avancarLead = async (lead: Lead) => {
    const idx = ORDEM_LEAD.indexOf(lead.status);
    if (idx >= ORDEM_LEAD.length - 2) return; // não avança de convertido/perdido
    const novoStatus = ORDEM_LEAD[idx + 1];
    await (supabase as any).from("nutrir_leads").update({ status: novoStatus }).eq("id", lead.id);
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: novoStatus } : l));
    toast({ title: `Lead movido para "${STATUS_LEAD[novoStatus].label}"` });
  };

  // ─── dados derivados ──────────────────────────────────────────────────────
  const campanha = campanhas.find(c => c.id === campSel);

  const leadsVisiveis = useMemo(() => {
    let list = leads.filter(l => l.campanha_id === campSel);
    if (filtroStatus !== "todos") list = list.filter(l => l.status === filtroStatus);
    if (busca.trim()) {
      const b = busca.toLowerCase();
      list = list.filter(l =>
        l.nome.toLowerCase().includes(b) ||
        (l.cidade ?? "").toLowerCase().includes(b) ||
        (l.cultura ?? "").toLowerCase().includes(b)
      );
    }
    return list;
  }, [leads, campSel, filtroStatus, busca]);

  const kpisCamp = useMemo(() => {
    if (!campSel) return null;
    const todos = leads.filter(l => l.campanha_id === campSel);
    const por: Record<string, number> = {};
    ORDEM_LEAD.forEach(s => { por[s] = todos.filter(l => l.status === s).length; });
    const taxa = todos.length > 0 ? (por.convertido / todos.length) * 100 : 0;
    return { total: todos.length, por, taxa };
  }, [leads, campSel]);

  // funil chart
  const funilData = useMemo(() => {
    if (!kpisCamp) return [];
    return ORDEM_LEAD.slice(0, 4).map(s => ({
      name: STATUS_LEAD[s].label, value: kpisCamp.por[s],
    }));
  }, [kpisCamp]);

  // KPIs globais
  const totalLeads = leads.length;
  const convertidos = leads.filter(l => l.status === "convertido").length;
  const campAtivas = campanhas.filter(c => c.status === "ativa").length;
  const taxaGlobal = totalLeads > 0 ? (convertidos / totalLeads) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Geração de Demanda"
        description="Campanhas de prospecção e acompanhamento de leads"
        actions={
          <Button size="sm" onClick={() => { setEditCamp(CAMP_VAZIO); setOpenCamp(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova campanha
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-5">

        {/* KPIs globais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          {[
            { icon: Megaphone,   label: "Campanhas ativas",  value: campAtivas,           cls: "text-primary" },
            { icon: Users,       label: "Total de leads",     value: totalLeads,           cls: "" },
            { icon: CheckCircle2,label: "Convertidos",        value: convertidos,          cls: "text-emerald-600" },
            { icon: Target,      label: "Taxa de conversão",  value: `${taxaGlobal.toFixed(1)}%`, cls: taxaGlobal >= 20 ? "text-emerald-600" : "text-amber-600" },
          ].map(k => (
            <Card key={k.label}><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <k.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <div className={`text-2xl font-bold ${k.cls}`}>{k.value}</div>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="campanhas">
          <TabsList>
            <TabsTrigger value="campanhas"><Megaphone className="h-3.5 w-3.5 mr-1" />Campanhas</TabsTrigger>
            <TabsTrigger value="calendario"><CalendarDays className="h-3.5 w-3.5 mr-1" />Calendário & Gatilhos</TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas" className="mt-4">
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Lista de campanhas */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> Campanhas ({campanhas.length})
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : campanhas.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma campanha. Clique em "Nova campanha".
              </CardContent></Card>
            ) : campanhas.map(c => {
              const qtdLeads = leads.filter(l => l.campanha_id === c.id).length;
              const cfg = STATUS_CAMP[c.status];
              const ativa = campSel === c.id;
              return (
                <Card
                  key={c.id}
                  className={`cursor-pointer transition-all ${ativa ? "ring-2 ring-primary" : "hover:shadow-sm"}`}
                  onClick={() => { setCampSel(c.id); setFiltroStatus("todos"); setBusca(""); }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.nome}</p>
                        {c.produto && <p className="text-xs text-muted-foreground">{c.produto}</p>}
                        {c.regiao  && <p className="text-xs text-muted-foreground">{c.regiao}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge>
                          <span className="text-[10px] text-muted-foreground">{qtdLeads}/{c.meta_leads} leads</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setEditCamp(c); setOpenCamp(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); deletarCamp(c.id); }}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {/* barra de progresso */}
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (qtdLeads / (c.meta_leads || 1)) * 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Painel de leads */}
          <div className="lg:col-span-2 space-y-3">
            {!campSel ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">
                <Megaphone className="h-10 w-10 mx-auto opacity-20 mb-2" />
                Selecione uma campanha para ver seus leads
              </CardContent></Card>
            ) : (
              <>
                {/* Header da campanha */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold">{campanha?.nome}</h3>
                    {campanha?.descricao && <p className="text-xs text-muted-foreground">{campanha.descricao}</p>}
                  </div>
                  <Button size="sm" onClick={() => { setEditLead(LEAD_VAZIO); setOpenLead(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Novo lead
                  </Button>
                </div>

                {/* KPIs da campanha + funil */}
                {kpisCamp && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card><CardContent className="p-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {ORDEM_LEAD.slice(0, 4).map(s => {
                          const cfg = STATUS_LEAD[s];
                          return (
                            <div key={s} className={`rounded p-1.5 ${cfg.cls}`}>
                              <div className="text-lg font-bold">{kpisCamp.por[s]}</div>
                              <div className="text-[10px]">{cfg.label}</div>
                            </div>
                          );
                        })}
                        <div className="rounded p-1.5 bg-red-50 text-red-700">
                          <div className="text-lg font-bold">{kpisCamp.por.perdido}</div>
                          <div className="text-[10px]">Perdido</div>
                        </div>
                        <div className="rounded p-1.5 bg-primary/10 text-primary col-span-2">
                          <div className="text-lg font-bold">{kpisCamp.taxa.toFixed(0)}%</div>
                          <div className="text-[10px]">Taxa conversão</div>
                        </div>
                      </div>
                    </CardContent></Card>

                    <Card><CardContent className="p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Funil de leads</p>
                      <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={funilData} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" width={75} fontSize={10} />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent></Card>
                  </div>
                )}

                {/* Filtros */}
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar lead…" className="pl-8 h-8 w-48" />
                  </div>
                  <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {ORDEM_LEAD.map(s => <SelectItem key={s} value={s}>{STATUS_LEAD[s].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground self-center">{leadsVisiveis.length} lead(s)</span>
                </div>

                {/* Lista de leads */}
                {leadsVisiveis.length === 0 ? (
                  <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
                    Nenhum lead encontrado.
                  </CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {leadsVisiveis.map(l => {
                      const cfg = STATUS_LEAD[l.status];
                      const Icon = cfg.icon;
                      const podeAvancar = l.status !== "convertido" && l.status !== "perdido";
                      return (
                        <Card key={l.id} className="hover:shadow-sm transition">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{l.nome}</span>
                                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.cls}`}>
                                    <Icon className="w-3 h-3" />{cfg.label}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                  {l.cidade   && <span>{l.cidade}</span>}
                                  {l.cultura  && <span>🌱 {l.cultura}</span>}
                                  {l.area_ha  && <span>{l.area_ha} ha</span>}
                                  {l.telefone && <span>📞 {l.telefone}</span>}
                                </div>
                                {l.observacoes && <p className="text-xs text-muted-foreground mt-1 italic truncate">{l.observacoes}</p>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                {podeAvancar && (
                                  <Button variant="outline" size="icon" className="h-7 w-7" title="Avançar etapa" onClick={() => avancarLead(l)}>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditLead(l); setOpenLead(true); }}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                                  if (!confirm("Excluir lead?")) return;
                                  await (supabase as any).from("nutrir_leads").delete().eq("id", l.id);
                                  setLeads(ls => ls.filter(x => x.id !== l.id));
                                }}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
          </TabsContent>

          {/* ── Calendário Agrícola & Gatilhos ── */}
          <TabsContent value="calendario" className="mt-4 space-y-4">

            {/* Seletor de UF + buscar clima */}
            <Card><CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Estado (UF)</label>
                  <Select value={climaUF} onValueChange={setClimaUF}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["MT","MS","GO","PR","RS","SP","MG","BA","PI","MA"].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Latitude</label>
                  <Input className="w-28" value={climaLat} onChange={e => setClimaLat(e.target.value)} placeholder="-15.60" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Longitude</label>
                  <Input className="w-28" value={climaLng} onChange={e => setClimaLng(e.target.value)} placeholder="-56.10" />
                </div>
                <Button onClick={buscarClima} disabled={climaLoading} className="bg-gradient-primary">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${climaLoading ? "animate-spin" : ""}`} />
                  {climaLoading ? "Buscando…" : "Atualizar clima + alertas"}
                </Button>
              </div>
            </CardContent></Card>

            <div className="grid md:grid-cols-2 gap-4">

              {/* Alertas preditivos */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" /> Alertas & IA preditiva
                </h3>
                {alertas.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto opacity-20 mb-2" />
                    Clique em "Atualizar" para gerar alertas baseados em clima + calendário + leads.
                  </CardContent></Card>
                ) : alertas.map((a, i) => (
                  <div key={i} className={`rounded-lg border p-3 space-y-1 ${
                    a.urgencia === "alta" ? "border-red-300 bg-red-50" :
                    a.urgencia === "media" ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wide ${
                        a.urgencia === "alta" ? "text-red-700" : a.urgencia === "media" ? "text-amber-700" : "text-blue-700"
                      }`}>
                        {a.urgencia === "alta" ? "🔴" : a.urgencia === "media" ? "🟡" : "🔵"} {a.tipo}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{a.mensagem}</p>
                  </div>
                ))}
              </div>

              {/* Calendário agrícola */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sprout className="h-4 w-4 text-emerald-600" /> Calendário Agrícola — {climaUF}
                </h3>
                {(() => {
                  const mesAtual = new Date().getMonth() + 1;
                  const janelasUF = CALENDARIO.filter(j => j.uf === climaUF);
                  if (janelasUF.length === 0) return (
                    <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma janela cadastrada para {climaUF}.
                    </CardContent></Card>
                  );
                  return janelasUF.map((j, idx) => {
                    const { distancia, emJanela } = janelaProxima(mesAtual, j);
                    const temLeads = leads.filter(l => l.cultura === j.cultura).length;
                    return (
                      <Card key={idx} className={emJanela ? "border-emerald-400 bg-emerald-50/50" : ""}>
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm flex items-center gap-1.5">
                              <Sprout className="h-3.5 w-3.5 text-emerald-600" /> {j.cultura}
                            </span>
                            {emJanela
                              ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">✓ Janela aberta</Badge>
                              : <Badge variant="outline" className="text-[10px]">~{distancia} mês(es)</Badge>
                            }
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {j.estagios.map(e => (
                              <span key={e} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{e}</span>
                            ))}
                          </div>
                          {temLeads > 0 && (
                            <div className="text-xs text-primary font-medium">
                              👥 {temLeads} lead(s) com esta cultura — oportunidade de abordagem!
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Previsão do tempo 7 dias */}
            {climaData && (
              <Card><CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <CloudRain className="h-4 w-4 text-blue-500" /> Previsão 7 dias — {climaUF}
                </h3>
                <div className="grid grid-cols-7 gap-1">
                  {(climaData.time ?? []).map((d: string, i: number) => {
                    const chuva = climaData.precipitation_sum?.[i] ?? 0;
                    const tMax  = climaData.temperature_2m_max?.[i] ?? 0;
                    const tMin  = climaData.temperature_2m_min?.[i] ?? 0;
                    const vento = climaData.windspeed_10m_max?.[i] ?? 0;
                    const dia   = new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" });
                    return (
                      <div key={d} className={`rounded-lg border p-2 text-center space-y-1 ${chuva > 20 ? "bg-blue-50 border-blue-200" : ""}`}>
                        <div className="text-[9px] text-muted-foreground font-medium uppercase">{dia}</div>
                        <div className="text-base">{chuva > 20 ? "🌧️" : chuva > 5 ? "🌦️" : "☀️"}</div>
                        <div className="text-[10px] font-bold">{Math.round(tMax)}°</div>
                        <div className="text-[9px] text-muted-foreground">{Math.round(tMin)}°</div>
                        {chuva > 0 && <div className="text-[9px] text-blue-600">{chuva.toFixed(0)}mm</div>}
                        {vento > 30 && <div className="text-[9px] text-amber-600">{Math.round(vento)}km/h</div>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="text-xs text-center bg-muted rounded p-2">
                    <CloudRain className="h-3.5 w-3.5 mx-auto mb-1 text-blue-500" />
                    <div className="font-bold">{((climaData.precipitation_sum ?? []) as number[]).reduce((a, b) => a + (b ?? 0), 0).toFixed(0)} mm</div>
                    <div className="text-muted-foreground">Chuva total</div>
                  </div>
                  <div className="text-xs text-center bg-muted rounded p-2">
                    <Thermometer className="h-3.5 w-3.5 mx-auto mb-1 text-red-500" />
                    <div className="font-bold">{Math.round(Math.max(...((climaData.temperature_2m_max ?? []) as number[])))}°C</div>
                    <div className="text-muted-foreground">Temp. máx.</div>
                  </div>
                  <div className="text-xs text-center bg-muted rounded p-2">
                    <Wind className="h-3.5 w-3.5 mx-auto mb-1 text-slate-500" />
                    <div className="font-bold">{Math.round(Math.max(...((climaData.windspeed_10m_max ?? []) as number[])))} km/h</div>
                    <div className="text-muted-foreground">Vento máx.</div>
                  </div>
                </div>
              </CardContent></Card>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* Dialog campanha */}
      <Dialog open={openCamp} onOpenChange={v => { setOpenCamp(v); if (!v) setEditCamp(CAMP_VAZIO); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editCamp.id ? "Editar" : "Nova"} campanha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nome *</label>
              <Input value={editCamp.nome ?? ""} onChange={e => setEditCamp(c => ({ ...c, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Produto</label>
                <Input value={editCamp.produto ?? ""} onChange={e => setEditCamp(c => ({ ...c, produto: e.target.value }))} placeholder="Ex.: N180 TSH" />
              </div>
              <div>
                <label className="text-xs font-medium">Região</label>
                <Input value={editCamp.regiao ?? ""} onChange={e => setEditCamp(c => ({ ...c, regiao: e.target.value }))} placeholder="Ex.: MT Sul" />
              </div>
              <div>
                <label className="text-xs font-medium">Status</label>
                <Select value={editCamp.status ?? "planejamento"} onValueChange={v => setEditCamp(c => ({ ...c, status: v as StatusCamp }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_CAMP) as StatusCamp[]).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_CAMP[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Meta de leads</label>
                <Input type="number" value={editCamp.meta_leads ?? 50} onChange={e => setEditCamp(c => ({ ...c, meta_leads: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Data início</label>
                <Input type="date" value={editCamp.data_inicio ?? ""} onChange={e => setEditCamp(c => ({ ...c, data_inicio: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Data fim</label>
                <Input type="date" value={editCamp.data_fim ?? ""} onChange={e => setEditCamp(c => ({ ...c, data_fim: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Descrição</label>
              <Textarea value={editCamp.descricao ?? ""} onChange={e => setEditCamp(c => ({ ...c, descricao: e.target.value }))} rows={2} />
            </div>
            <Button className="w-full" onClick={salvarCamp} disabled={savingC}>
              {savingC ? "Salvando…" : "Salvar campanha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog lead */}
      <Dialog open={openLead} onOpenChange={v => { setOpenLead(v); if (!v) setEditLead(LEAD_VAZIO); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editLead.id ? "Editar" : "Novo"} lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nome *</label>
              <Input value={editLead.nome ?? ""} onChange={e => setEditLead(l => ({ ...l, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Telefone</label>
                <Input value={editLead.telefone ?? ""} onChange={e => setEditLead(l => ({ ...l, telefone: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">E-mail</label>
                <Input type="email" value={editLead.email ?? ""} onChange={e => setEditLead(l => ({ ...l, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Cidade</label>
                <Input value={editLead.cidade ?? ""} onChange={e => setEditLead(l => ({ ...l, cidade: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Área (ha)</label>
                <Input type="number" value={editLead.area_ha ?? ""} onChange={e => setEditLead(l => ({ ...l, area_ha: parseFloat(e.target.value) || undefined }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Cultura</label>
                <Input value={editLead.cultura ?? ""} onChange={e => setEditLead(l => ({ ...l, cultura: e.target.value }))} placeholder="Soja, Milho…" />
              </div>
              <div>
                <label className="text-xs font-medium">Status</label>
                <Select value={editLead.status ?? "novo"} onValueChange={v => setEditLead(l => ({ ...l, status: v as StatusLead }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORDEM_LEAD.map(s => <SelectItem key={s} value={s}>{STATUS_LEAD[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Observações</label>
              <Textarea value={editLead.observacoes ?? ""} onChange={e => setEditLead(l => ({ ...l, observacoes: e.target.value }))} rows={2} />
            </div>
            <Button className="w-full" onClick={salvarLead} disabled={savingL}>
              {savingL ? "Salvando…" : "Salvar lead"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
