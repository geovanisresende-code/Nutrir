import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, Save } from "lucide-react";

const MARGENS = [
  { v: "diamante", l: "Diamante", pct: 80, color: "bg-blue-100 text-blue-800" },
  { v: "ouro", l: "Ouro", pct: 55, color: "bg-yellow-100 text-yellow-800" },
  { v: "prata", l: "Prata", pct: 35, color: "bg-gray-200 text-gray-800" },
  { v: "bronze", l: "Bronze", pct: 20, color: "bg-orange-100 text-orange-800" },
];

type Produto = { id: string; nome: string; preco_custo: number | null; classificacao: string | null; linha: string | null };

export default function PrecificacaoProdutos() {
  const { current } = useOrg();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [margens, setMargens] = useState<Record<string, number>>(Object.fromEntries(MARGENS.map(m => [m.v, m.pct])));
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!current) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from("nutrir_produtos").select("id,nome,preco_custo,classificacao,linha").eq("organization_id", current.id).eq("ativo", true).order("nome").limit(500);
      setProdutos(data ?? []);
      setLoading(false);
    })();
  }, [current?.id]);

  const calcVenda = (custo: number, pct: number) => custo * (1 + pct / 100);

  const salvarPreco = async (p: Produto) => {
    const novoCusto = edits[p.id] ?? p.preco_custo ?? 0;
    setSaving(true);
    const { error } = await (supabase as any).from("nutrir_produtos").update({ preco_custo: novoCusto }).eq("id", p.id);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Custo atualizado" });
    setProdutos(produtos.map(x => x.id === p.id ? { ...x, preco_custo: novoCusto } : x));
    const e = { ...edits }; delete e[p.id]; setEdits(e);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="w-6 h-6 text-primary"/>Precificação de Produtos</h1>
        <p className="text-muted-foreground text-sm">Margens por categoria e cálculo automático de preço de venda.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4"/>Margens por classificação</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MARGENS.map(m => (
              <div key={m.v}>
                <label className="text-xs font-medium block mb-1">
                  <Badge className={m.color + " mr-1"}>{m.l}</Badge>
                </label>
                <div className="relative">
                  <Input type="number" step="1" value={margens[m.v]} onChange={e => setMargens({ ...margens, [m.v]: parseFloat(e.target.value) || 0 })}/>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Margens aplicadas sobre o custo. Ajuste e veja a tabela abaixo recalcular.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Catálogo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-left px-3 py-2">Classe</th>
                <th className="text-right px-3 py-2">Custo (R$)</th>
                {MARGENS.map(m => <th key={m.v} className="text-right px-3 py-2">{m.l}</th>)}
                <th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={3+MARGENS.length+1} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr> :
                 produtos.length === 0 ? <tr><td colSpan={3+MARGENS.length+1} className="px-3 py-6 text-center text-muted-foreground">Nenhum produto.</td></tr> :
                 produtos.map(p => {
                  const custo = edits[p.id] ?? p.preco_custo ?? 0;
                  const dirty = edits[p.id] != null;
                  return (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{p.nome}{p.linha && <span className="text-xs text-muted-foreground ml-1">· {p.linha}</span>}</td>
                      <td className="px-3 py-2">{p.classificacao && <Badge variant="outline">{p.classificacao}</Badge>}</td>
                      <td className="px-3 py-2">
                        <Input type="number" step="0.01" className="h-8 text-right w-24 ml-auto" value={custo} onChange={e => setEdits({ ...edits, [p.id]: parseFloat(e.target.value) || 0 })}/>
                      </td>
                      {MARGENS.map(m => (
                        <td key={m.v} className="px-3 py-2 text-right tabular-nums text-xs">
                          R$ {calcVenda(custo, margens[m.v]).toFixed(2)}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {dirty && <Button size="sm" variant="ghost" onClick={() => salvarPreco(p)} disabled={saving}><Save className="w-4 h-4"/></Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
