import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Target, TrendingUp, Wallet, Award, Download, Users, CheckCircle } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { usePosition } from "@/hooks/usePosition";

const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct2 = (n: number) => `${Number(n || 0).toFixed(2)}%`;

type Tier = "diamante" | "ouro" | "prata" | "bronze" | "sem_tier";

function calcTier(pctMeta: number): Tier {
  if (pctMeta >= 120) return "diamante";
  if (pctMeta >= 100) return "ouro";
  if (pctMeta >= 80)  return "prata";
  if (pctMeta >= 60)  return "bronze";
  return "sem_tier";
}

const TIER_CONFIG: Record<Tier, { label: string; emoji: string; cor: string; bg: string; border: string; minPct: number }> = {
  diamante: { label: "Diamante", emoji: "💎", cor: "text-cyan-700",   bg: "bg-cyan-50",   border: "border-cyan-300",   minPct: 120 },
  ouro:     { label: "Ouro",     emoji: "🥇", cor: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300", minPct: 100 },
  prata:    { label: "Prata",    emoji: "🥈", cor: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-300",  minPct: 80  },
  bronze:   { label: "Bronze",   emoji: "🥉", cor: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", minPct: 60  },
  sem_tier: { label: "—",        emoji: "",   cor: "text-muted-foreground", bg: "bg-muted/40", border: "border-muted", minPct: 0 },
};

function TierBadge({ pct }: { pct: number }) {
  const tier = calcTier(pct);
  const cfg = TIER_CONFIG[tier];
  if (tier === "sem_tier") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.cor} ${cfg.border}`}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

const STATUS_COLOR: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  prevista: "outline", apurada: "secondary", paga: "default", cancelada: "destructive",
};
const STATUS_LABEL: Record<string, string> = {
  prevista: "Prevista", apurada: "Apurada", paga: "Paga", cancelada: "Cancelada",
};

function mesesRecentes(n = 12) {
  const out: { v: string; l: string }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const v = dd.toISOString().slice(0, 7) + "-01";
    const l = dd.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    out.push({ v, l });
  }
  return out;
}

function exportCSV(rows: any[], clientes: Record<string, string>) {
  const header = "Cliente,Base,Percentual,Comissão,Status,Pagamento\n";
  const body = rows.map(r =>
    [clientes[r.cliente_id] ?? "—", r.base_calculo, r.percentual, r.valor, r.status, r.data_pagamento ?? "—"].join(",")
  ).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "comissoes.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ─── MinhasComissoes ─────────────────────────────────────────────────────── */
function MinhasComissoes() {
  const { current } = useOrg();
  const { user } = useAuth();
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7) + "-01");
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<number>(0);
  const [bonusPct, setBonusPct] = useState<number>(0);
  const [historico, setHistorico] = useState<{ mes: string; total: number }[]>([]);

  const load = async () => {
    if (!current || !user) return;
    const { data } = await (supabase as any)
      .from("nutrir_comissoes").select("*")
      .eq("organization_id", current.id).eq("mes_referencia", mes)
      .order("created_at", { ascending: false });
    setItems((data as any[]) ?? []);

    const ids = Array.from(new Set(((data as any[]) ?? []).map((i: any) => i.cliente_id).filter(Boolean)));
    if (ids.length) {
      const { data: cs } = await supabase.from("nutrir_clientes" as any).select("id,razao_social").in("id", ids as string[]);
      const map: Record<string, string> = {};
      (cs ?? []).forEach((c: any) => { map[c.id] = c.razao_social; });
      setClientes(map);
    }

    const { data: col } = await (supabase as any)
      .from("nutrir_colaboradores").select("meta_mensal,bonus_meta_pct")
      .eq("organization_id", current.id).eq("user_id", user.id).maybeSingle();
    setMeta(Number(col?.meta_mensal ?? 0));
    setBonusPct(Number(col?.bonus_meta_pct ?? 0));

    const meses6 = mesesRecentes(6).map(m => m.v);
    const { data: hist } = await (supabase as any)
      .from("nutrir_comissoes").select("mes_referencia,valor")
      .eq("organization_id", current.id).in("mes_referencia", meses6);
    const hmap = new Map<string, number>();
    (hist ?? []).forEach((h: any) => { hmap.set(h.mes_referencia, (hmap.get(h.mes_referencia) ?? 0) + Number(h.valor || 0)); });
    setHistorico(meses6.reverse().map(m => ({ mes: m.slice(5, 7) + "/" + m.slice(2, 4), total: hmap.get(m) ?? 0 })));
  };

  useEffect(() => { load(); }, [current?.id, mes, user?.id]); // eslint-disable-line

  const totais = useMemo(() => {
    const base = items.reduce((a, i) => a + Number(i.base_calculo || 0), 0);
    const com  = items.reduce((a, i) => a + Number(i.valor || 0), 0);
    const bonus = meta > 0 && base >= meta ? (base * bonusPct) / 100 : 0;
    return { base, com, bonus, total: com + bonus };
  }, [items, meta, bonusPct]);

  const pctMeta = meta > 0 ? Math.min(100, (totais.base / meta) * 100) : 0;
  const falta   = meta > 0 ? Math.max(0, meta - totais.base) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-56">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {mesesRecentes(12).map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={() => exportCSV(items, clientes)}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Vendas no mês</div>
          <div className="text-2xl font-bold">{money(totais.base)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Comissão base</div>
          <div className="text-2xl font-bold">{money(totais.com)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Bônus por meta</div>
          <div className="text-2xl font-bold text-amber-600">{money(totais.bonus)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Total a receber</div>
          <div className="text-2xl font-bold text-primary">{money(totais.total)}</div>
        </CardContent></Card>
      </div>

      {meta > 0 && (() => {
        const tier = calcTier(pctMeta);
        const cfg = TIER_CONFIG[tier];
        return (
          <Card className={`border-2 ${cfg.border}`}><CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-1.5"><Target className="h-4 w-4" /> Meta mensal</span>
              <div className="flex items-center gap-2">
                <TierBadge pct={pctMeta} />
                <span className="text-muted-foreground">{money(totais.base)} / {money(meta)}</span>
              </div>
            </div>
            <Progress value={pctMeta} />
            <div className="text-xs text-muted-foreground">
              {falta > 0 ? `Faltam ${money(falta)} para bater a meta. Bônus de ${bonusPct}% ao atingir.` : `🎉 Meta batida! Bônus de ${pct2(bonusPct)} aplicado.`}
            </div>
            <div className="flex gap-1.5 pt-1 flex-wrap">
              {(["bronze","prata","ouro","diamante"] as Tier[]).map((t) => {
                const tc = TIER_CONFIG[t];
                const ativo = tier === t;
                return (
                  <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border ${tc.bg} ${tc.cor} ${tc.border} ${ativo ? "font-bold ring-2 ring-offset-1 ring-current" : "opacity-60"}`}>
                    {tc.emoji} {tc.label} ≥{tc.minPct}%
                  </span>
                );
              })}
            </div>
          </CardContent></Card>
        );
      })()}

      {historico.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">Comissões — últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={historico}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <div className="p-4 flex items-center justify-between">
          <span className="font-semibold">Pedidos do mês</span>
        </div>
        {items.length === 0 ? (
          <div className="p-6 pt-0 text-sm text-muted-foreground">Sem comissões neste mês.</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pago em</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{clientes[i.cliente_id] ?? "—"}</TableCell>
                  <TableCell className="text-right">{money(Number(i.base_calculo))}</TableCell>
                  <TableCell className="text-right">{pct2(Number(i.percentual))}</TableCell>
                  <TableCell className="text-right font-medium text-primary">{money(Number(i.valor))}</TableCell>
                  <TableCell><Badge variant={STATUS_COLOR[i.status]}>{STATUS_LABEL[i.status] ?? i.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.data_pagamento ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}

/* ─── RankingEquipe ───────────────────────────────────────────────────────── */
function RankingEquipe() {
  const { current } = useOrg();
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7) + "-01");
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [representantes, setRepresentantes] = useState<any[]>([]);

  const load = async () => {
    if (!current) return;
    const [{ data: com }, { data: col }, { data: rep }] = await Promise.all([
      (supabase as any).from("nutrir_comissoes").select("*").eq("organization_id", current.id).eq("mes_referencia", mes),
      (supabase as any).from("nutrir_colaboradores").select("id,nome,user_id,meta_mensal,bonus_meta_pct").eq("organization_id", current.id),
      (supabase as any).from("nutrir_representantes").select("id,nome").eq("organization_id", current.id),
    ]);
    setComissoes((com as any[]) ?? []);
    setColaboradores((col as any[]) ?? []);
    setRepresentantes((rep as any[]) ?? []);
  };

  useEffect(() => { load(); }, [current?.id, mes]); // eslint-disable-line

  const ranking = useMemo(() => {
    const map = new Map<string, { base: number; comissao: number; bonus: number; pedidos: number }>();
    comissoes.forEach(c => {
      const k = c.representante_id ?? "_sem";
      const cur = map.get(k) ?? { base: 0, comissao: 0, bonus: 0, pedidos: 0 };
      cur.base += Number(c.base_calculo || 0);
      cur.comissao += Number(c.valor || 0);
      cur.pedidos += 1;
      map.set(k, cur);
    });
    return Array.from(map.entries()).map(([reprId, v]) => {
      const rep = representantes.find(r => r.id === reprId);
      const col = colaboradores.find(c => c.user_id === reprId || c.id === reprId);
      const meta = Number(col?.meta_mensal ?? 0);
      const bonusPct = Number(col?.bonus_meta_pct ?? 0);
      const bonus = meta > 0 && v.base >= meta ? (v.base * bonusPct) / 100 : 0;
      const pct = meta > 0 ? Math.min(100, (v.base / meta) * 100) : 0;
      return { id: reprId, nome: reprId === "_sem" ? "Sem representante" : rep?.nome ?? col?.nome ?? "—", ...v, meta, bonus, pct, total: v.comissao + bonus };
    }).sort((a, b) => b.base - a.base);
  }, [comissoes, representantes, colaboradores]);

  const totalGeral = useMemo(() => ({
    base: ranking.reduce((a, r) => a + r.base, 0),
    comissao: ranking.reduce((a, r) => a + r.comissao, 0),
    bonus: ranking.reduce((a, r) => a + r.bonus, 0),
  }), [ranking]);

  return (
    <div className="space-y-4">
      <div className="w-56">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {mesesRecentes(12).map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Faturamento total</div>
          <div className="text-2xl font-bold">{money(totalGeral.base)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Comissões totais</div>
          <div className="text-2xl font-bold">{money(totalGeral.comissao)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Bônus provisionados</div>
          <div className="text-2xl font-bold text-amber-600">{money(totalGeral.bonus)}</div>
        </CardContent></Card>
      </div>
      <Card><CardContent className="p-0">
        <div className="p-4 font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Ranking — {mes.slice(5,7)}/{mes.slice(2,4)}</div>
        {ranking.length === 0 ? <div className="p-6 pt-0 text-sm text-muted-foreground">Sem dados neste mês.</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>Representante</TableHead><TableHead>Tier</TableHead>
              <TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Comissão</TableHead>
              <TableHead className="text-right">Bônus</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ranking.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell><span className={`font-bold ${i === 0 ? "text-yellow-600" : i === 1 ? "text-slate-500" : i === 2 ? "text-orange-500" : ""}`}>{i+1}º</span></TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell><TierBadge pct={r.pct} /></TableCell>
                  <TableCell className="text-right">{money(r.base)}</TableCell>
                  <TableCell className="text-right font-mono">{money(r.comissao)}</TableCell>
                  <TableCell className="text-right font-mono text-amber-600">{r.bonus > 0 ? money(r.bonus) : "—"}</TableCell>
                  <TableCell className="text-right font-bold">{money(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}

/* ─── PainelAdminComissoes ────────────────────────────────────────────────── */
function PainelAdminComissoes() {
  const { current } = useOrg();
  const [cols, setCols] = useState<any[]>([]);
  const [selectedCol, setSelectedCol] = useState<string>("");
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7) + "-01");
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [salario, setSalario] = useState("");
  const [adiantamento, setAdiantamento] = useState("");
  const [auxilio_carro, setAuxilioCarro] = useState("");
  const [bonificacao, setBonificacao] = useState("");
  const [obs_folha, setObsFolha] = useState("");

  const load = async () => {
    if (!current) return;
    const { data: c } = await (supabase as any)
      .from("nutrir_colaboradores")
      .select("id,nome,cargo,meta_mensal,bonus_meta_pct,user_id,salario_base,auxilio_carro,adiantamento_max")
      .eq("organization_id", current.id);
    setCols((c as any[]) ?? []);
    const { data: com } = await (supabase as any)
      .from("nutrir_comissoes").select("*")
      .eq("organization_id", current.id).eq("mes_referencia", mes)
      .order("created_at", { ascending: false });
    setComissoes((com as any[]) ?? []);
  };

  useEffect(() => { load(); }, [current?.id, mes]); // eslint-disable-line

  const col = cols.find(c => c.id === selectedCol);

  useEffect(() => {
    if (col) {
      setSalario(col.salario_base ? String(col.salario_base) : "");
      setAuxilioCarro(col.auxilio_carro ? String(col.auxilio_carro) : "");
      setAdiantamento(col.adiantamento_max ? String(col.adiantamento_max) : "");
      setBonificacao(""); setObsFolha("");
    }
  }, [col?.id]); // eslint-disable-line

  const saveColaborador = async () => {
    if (!col || !current) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("nutrir_colaboradores").update({
        salario_base: Number(salario) || null,
        auxilio_carro: Number(auxilio_carro) || null,
        adiantamento_max: Number(adiantamento) || null,
      }).eq("id", col.id);
      if (error) throw error;
      if (Number(bonificacao) > 0) {
        await (supabase as any).from("nutrir_comissoes").insert({
          organization_id: current.id, colaborador_id: col.id, mes_referencia: mes,
          tipo: "bonificacao", base_calculo: 0, percentual: 0, valor: Number(bonificacao),
          status: "apurada", descricao: obs_folha || "Bonificação manual",
        });
      }
      toast.success("Dados salvos!"); load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const totaisPorCol = useMemo(() => {
    const map: Record<string, { base: number; com: number }> = {};
    comissoes.forEach(c => {
      const k = c.colaborador_id ?? c.user_id ?? "?";
      if (!map[k]) map[k] = { base: 0, com: 0 };
      map[k].base += Number(c.base_calculo || 0);
      map[k].com  += Number(c.valor || 0);
    });
    return map;
  }, [comissoes]);

  const folhaConsolidada = cols.map(c => {
    const totais = totaisPorCol[c.id] ?? { base: 0, com: 0 };
    const bonuses = comissoes.filter(x => (x.colaborador_id === c.id || x.user_id === c.user_id) && x.tipo === "bonificacao")
      .reduce((a, x) => a + Number(x.valor || 0), 0);
    const pctMeta = c.meta_mensal > 0 ? totais.base / c.meta_mensal * 100 : 0;
    const bonusMeta = pctMeta >= 100 && c.bonus_meta_pct > 0 ? totais.base * c.bonus_meta_pct / 100 : 0;
    return {
      ...c, base_vendas: totais.base, comissoes_val: totais.com,
      bonuses, bonusMeta, pctMeta, tier: calcTier(pctMeta),
      totalBruto: Number(c.salario_base || 0) + totais.com + bonusMeta + bonuses + Number(c.auxilio_carro || 0),
    };
  });

  const exportFolha = () => {
    const header = "Colaborador,Cargo,Salário Base,Base Vendas,Comissões,Bônus Meta,Bonificações,Aux. Carro,Total Bruto,Tier\n";
    const rows = folhaConsolidada.map(c =>
      [c.nome, c.cargo, c.salario_base ?? 0, c.base_vendas, c.comissoes_val, c.bonusMeta, c.bonuses, c.auxilio_carro ?? 0, c.totalBruto, c.tier].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `folha-${mes.slice(0,7)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-56">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {mesesRecentes(12).map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={exportFolha}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar Folha CSV
        </Button>
      </div>

      <Card><CardContent className="p-0">
        <div className="p-4 font-semibold text-sm">Folha — {mes.slice(5,7)}/{mes.slice(2,4)}</div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Colaborador</TableHead><TableHead>Tier</TableHead>
            <TableHead className="text-right">Sal. Base</TableHead>
            <TableHead className="text-right">Vendas</TableHead>
            <TableHead className="text-right">Comissão</TableHead>
            <TableHead className="text-right">Bônus</TableHead>
            <TableHead className="text-right">Aux. Carro</TableHead>
            <TableHead className="text-right font-bold">Total</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {folhaConsolidada.map(c => (
              <TableRow key={c.id} className={`cursor-pointer ${selectedCol === c.id ? "bg-muted/60" : ""}`} onClick={() => setSelectedCol(c.id)}>
                <TableCell><div className="font-medium text-sm">{c.nome}</div><div className="text-xs text-muted-foreground">{c.cargo}</div></TableCell>
                <TableCell><TierBadge pct={c.pctMeta} /></TableCell>
                <TableCell className="text-right font-mono text-sm">{money(Number(c.salario_base || 0))}</TableCell>
                <TableCell className="text-right font-mono text-sm">{money(c.base_vendas)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{money(c.comissoes_val)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-amber-600">{c.bonusMeta > 0 ? money(c.bonusMeta) : "—"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{money(Number(c.auxilio_carro || 0))}</TableCell>
                <TableCell className="text-right font-bold">{money(c.totalBruto)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      {col && (
        <Card><CardContent className="p-4 space-y-4">
          <div className="font-semibold text-sm">{col.nome} — editar remuneração</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l: "Salário Base (R$)", v: salario, fn: setSalario },
              { l: "Adiantamento Máx (R$)", v: adiantamento, fn: setAdiantamento },
              { l: "Auxílio Carro (R$)", v: auxilio_carro, fn: setAuxilioCarro },
              { l: "Bonificação avulsa (R$)", v: bonificacao, fn: setBonificacao },
            ].map(({ l, v, fn }) => (
              <div key={l} className="space-y-1">
                <Label className="text-xs">{l}</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input inputMode="decimal" value={v} onChange={(e) => fn(e.target.value.replace(/[^\d,.]/g,""))} className="pl-7 h-8 text-sm" placeholder="0,00" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observação</Label>
            <Input value={obs_folha} onChange={(e) => setObsFolha(e.target.value)} placeholder="Ex.: Premiação trimestral" className="h-8 text-sm" />
          </div>
          <Button size="sm" onClick={saveColaborador} disabled={saving} className="bg-gradient-primary">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </CardContent></Card>
      )}
    </div>
  );
}

/* ─── Export default ──────────────────────────────────────────────────────── */
export default function Comissoes() {
  const { position } = usePosition();
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7) + "-01");
  const isGerente = ["proprietario", "diretor", "gerente"].includes(position ?? "");
  const meses = mesesRecentes(12);

  const seletor = (
    <Select value={mes} onValueChange={setMes}>
      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
      <SelectContent>
        {meses.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <PageHeader
        title="Comissões"
        description={isGerente ? "Acompanhe metas e comissões de toda a equipe" : "Suas comissões e metas do mês"}
        actions={seletor}
      />
      <div className="p-6 space-y-4">
        {isGerente ? (
          <Tabs defaultValue="minha">
            <TabsList>
              <TabsTrigger value="minha" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Minhas</TabsTrigger>
              <TabsTrigger value="equipe" className="gap-1.5"><Award className="h-3.5 w-3.5" /> Equipe</TabsTrigger>
              <TabsTrigger value="admin" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Painel Admin</TabsTrigger>
            </TabsList>
            <TabsContent value="minha" className="mt-4"><MinhasComissoes /></TabsContent>
            <TabsContent value="equipe" className="mt-4"><RankingEquipe /></TabsContent>
            <TabsContent value="admin" className="mt-4"><PainelAdminComissoes /></TabsContent>
          </Tabs>
        ) : (
          <MinhasComissoes />
        )}
      </div>
    </>
  );
}
