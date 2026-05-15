import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Target, TrendingUp, Wallet } from "lucide-react";

const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS_COLOR: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  prevista: "outline", apurada: "secondary", paga: "default", cancelada: "destructive",
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

export default function Comissoes() {
  const { current } = useOrg();
  const { user } = useAuth();
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7) + "-01");
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<number>(0);
  const [bonusPct, setBonusPct] = useState<number>(0);

  const load = async () => {
    if (!current) return;
    const { data } = await supabase
      .from("nutrir_comissoes" as any)
      .select("*")
      .eq("organization_id", current.id)
      .eq("mes_referencia", mes)
      .order("created_at", { ascending: false });
    setItems((data as any[]) ?? []);
    const ids = Array.from(new Set(((data as any[]) ?? []).map((i) => i.cliente_id).filter(Boolean)));
    if (ids.length) {
      const { data: cs } = await supabase.from("nutrir_clientes").select("id, razao_social").in("id", ids as string[]);
      const map: Record<string, string> = {};
      (cs ?? []).forEach((c: any) => { map[c.id] = c.razao_social; });
      setClientes(map);
    }
    // Buscar meta do colaborador (se eu sou o representante logado)
    if (user) {
      const { data: col } = await supabase
        .from("nutrir_colaboradores")
        .select("meta_mensal, bonus_meta_pct")
        .eq("organization_id", current.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setMeta(Number(col?.meta_mensal ?? 0));
      setBonusPct(Number(col?.bonus_meta_pct ?? 0));
    }
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
    <>
      <PageHeader
        title="Comissões"
        description="Acompanhamento por mês, meta e bonificação"
        actions={
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {mesesRecentes(12).map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Vendas no mês</div><div className="text-2xl font-bold">{money(totais.base)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Comissão base</div><div className="text-2xl font-bold">{money(totais.com)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Bônus por meta</div><div className="text-2xl font-bold text-[#b08826]">{money(totais.bonus)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total a receber</div><div className="text-2xl font-bold">{money(totais.total)}</div></CardContent></Card>
        </div>

        {meta > 0 && (
          <Card><CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-1.5"><Target className="h-4 w-4" /> Meta mensal</span>
              <span className="text-muted-foreground">{money(totais.base)} / {money(meta)}</span>
            </div>
            <Progress value={pctMeta} />
            <div className="text-xs text-muted-foreground">
              {falta > 0
                ? `Faltam ${money(falta)} para bater a meta. Bônus de ${bonusPct}% sobre as vendas será aplicado ao atingir.`
                : `🎉 Meta batida! Bônus de ${bonusPct}% aplicado.`}
            </div>
          </CardContent></Card>
        )}

        <Card><CardContent className="p-0">
          <div className="p-4 font-semibold">Pedidos do mês</div>
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
                    <TableCell className="text-right">{Number(i.percentual).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-medium">{money(Number(i.valor))}</TableCell>
                    <TableCell><Badge variant={STATUS_COLOR[i.status]}>{i.status}</Badge></TableCell>
                    <TableCell className="text-xs">{i.data_pagamento ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>
      </div>
    </>
  );
}
