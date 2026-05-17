import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Target, TrendingUp, Wallet, Award, Download, Users, CheckCircle } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { usePosition } from "@/hooks/usePosition";

const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct2 = (n: number) => `${Number(n || 0).toFixed(2)}%`;

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

// ─── Export CSV ────────────────────────────────────────────────────────────────
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

// ─── Vista do representante ────────────────────────────────────────────────────
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
      .from("nutrir_comissoes")
      .select("*")
      .eq("organization_id", current.id)
      .eq("mes_referencia", mes)
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
      .from("nutrir_colaboradores")
      .select("meta_mensal,bonus_meta_pct")
      .eq("organization_id", current.id)
      .eq("user_id", user.id)
      .maybeSingle();
    setMeta(Number(col?.meta_mensal ?? 0));
    setBonusPct(Number(col?.bonus_meta_pct ?? 0));

    // Histórico dos últimos 6 meses
    const meses6 = mesesRecentes(6).map(m => m.v);
    const { data: hist } = await (supabase as any)
      .from("nutrir_comissoes")
      .select("mes_referencia,valor")
      .eq("organization_id", current.id)
      .in("mes_referencia", meses6);
    const hmap = new Map<string, number>();
    (hist ?? []).forEach((h: any) => {
      hmap.set(h.mes_referencia, (hmap.get(h.mes_referencia) ?? 0) + Number(h.valor || 0));
    });
    setHistorico(
      meses6.reverse().map(m => ({
        mes: m.slice(5, 7) + "/" + m.slice(2, 4),
        total: hmap.get(m) ?? 0,
      }))
    );
  };

  useEffect(() => { load(); }, [current?.id, mes, user?.id]);

  const totais = useMemo(() => {
    const base = items.reduce((a, i) => a + Number(i.base_calculo || 0), 0);
    const com = items.reduce((a, i) => a + Number(i.valor || 0), 0);
    const bonus = meta > 0 && base >= meta ? (base * bonusPct) / 100 : 0;
    return { base, com, bonus, total: com + bonus };
  }, [items, meta, bonusPct]);

  const pctMeta = meta > 0 ? Math.min(100, (totais.base / meta) * 100) : 0;
  const falta = meta > 0 ? Math.max(0, meta - totais.base) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Vendas no mês</div>
          <div className="text-2xl font-bold">{money(totais.base)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Comissão base</div>
          <div className="text-2xl font-bold">{money(totais.com)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Bônus por meta</div>
          <div className="text-2xl font-bold text-amber-600">{money(totais.bonus)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> Total a receber</div>
          <div className="text-2xl font-bold text-primary">{money(totais.total)}</div>
        </CardContent></Card>
      </div>

      {meta > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-1.5"><Target className="h-4 w-4" /> Meta mensal</span>
            <span className="text-muted-foreground">{money(totais.base)} / {money(meta)}</span>
          </div>
          <Progress value={pctMeta} className={pctMeta >= 100 ? "[&>div]:bg-green-500" : pctMeta >= 70 ? "[&>div]:bg-amber-500" : ""} />
          <div className="text-xs text-muted-foreground">
            {falta > 0
              ? `Faltam ${money(falta)} para bater a meta. Bônus de ${bonusPct}% ao atingir.`
              : `🎉 Meta batida! Bônus de ${pct2(bonusPct)} aplicado.`}
          </div>
        </CardContent></Card>
      )}

      {/* Histórico */}
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
          <Button size="sm" variant="outline" onClick={() => exportCSV(items, clientes)}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
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
                  <TableCell>
                    <Badge variant={STATUS_COLOR[i.status]}>{STATUS_LABEL[i.status] ?? i.status}</Badge>
                  </TableCell>
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

// ─── Vista do gerente — ranking geral ─────────────────────────────────────────
function RankingEquipe() {
  const { current } = useOrg();
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7) + "-01");
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [representantes, setRepresentantes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Record<string, string>>({});

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

    const ids = Array.from(new Set(((com as any[]) ?? []).map((i: any) => i.cliente_id).filter(Boolean)));
    if (ids.length) {
      const { data: cs } = await supabase.from("nutrir_clientes" as any).select("id,razao_social").in("id", ids as string[]);
      const map: Record<string, string> = {};
      (cs ?? []).forEach((c: any) => { map[c.id] = c.razao_social; });
      setClientes(map);
    }
  };

  useEffect(() => { load(); }, [current?.id, mes]);

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
      return {
        id: reprId,
        nome: reprId === "_sem" ? "Sem representante" : rep?.nome ?? col?.nome ?? "—",
        ...v, meta, bonus, pct, total: v.comissao + bonus,
      };
    }).sort((a, b) => b.base - a.base);
  }, [comissoes, representantes, colaboradores]);

  const totalGeral = useMemo(() => ({
    base: ranking.reduce((a, r) => a + r.base, 0),
    comissao: ranking.reduce((a, r) => a + r.comissao, 0),
    bonus: ranking.reduce((a, r) => a + r.bonus, 0),
  }), [ranking]);

  return (
    <div className="space-y-4">
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
        <div className="p-4 font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Ranking da equipe — {mes.slice(5, 7)}/{mes.slice(2, 4)}</div>
        {ranking.length === 0 ? (
          <div className="p-6 pt-0 text-sm text-muted-foreground">Sem dados neste mês.</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead>
              <TableHead>Representante</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right w-32">Progresso</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead className="text-right">Bônus</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ranking.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className={`font-bold ${i === 0 ? "text-yellow-600" : i === 1 ? "text-slate-500" : i === 2 ? "text-orange-500" : ""}`}>
                      {i + 1}º
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="text-right">{money(r.base)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.meta > 0 ? money(r.meta) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.meta > 0 ? (
                      <div className="flex items-center gap-1.5 justify-end">
                        <Progress value={r.pct} className={`w-20 h-1.5 ${r.pct >= 100 ? "[&>div]:bg-green-500" : r.pct >= 70 ? "[&>div]:bg-amber-500" : ""}`} />
                        <span className="text-xs w-8 text-right">{r.pct.toFixed(0)}%</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
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

// ─── Componente principal ──────────────────────────────────────────────────────
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
            </TabsList>
            <TabsContent value="minha" className="mt-4"><MinhasComissoes /></TabsContent>
            <TabsContent value="equipe" className="mt-4"><RankingEquipe /></TabsContent>
          </Tabs>
        ) : (
          <MinhasComissoes />
        )}
      </div>
    </>
  );
}
