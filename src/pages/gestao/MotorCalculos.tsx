import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, FileSpreadsheet, History } from "lucide-react";
import { Link } from "react-router-dom";

type Formula = { id: string; nome: string; codigo: string | null; status: string | null; descricao: string | null; updated_at: string };

export default function MotorCalculos() {
  const { current } = useOrg();
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [counts, setCounts] = useState<{ regras: number; limites: number; doses: number }>({ regras: 0, limites: 0, doses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    (async () => {
      setLoading(true);
      const [f, r, l, d] = await Promise.all([
        (supabase as any).from("nutrir_formula_cabecalho").select("*").eq("organization_id", current.id).order("nome"),
        (supabase as any).from("nutrir_formula_regra").select("id", { count: "exact", head: true }).eq("organization_id", current.id),
        (supabase as any).from("nutrir_formula_limite").select("id", { count: "exact", head: true }).eq("organization_id", current.id),
        (supabase as any).from("nutrir_formula_nivel_dose").select("id", { count: "exact", head: true }).eq("organization_id", current.id),
      ]);
      setFormulas(f.data ?? []);
      setCounts({ regras: r.count ?? 0, limites: l.count ?? 0, doses: d.count ?? 0 });
      setLoading(false);
    })();
  }, [current?.id]);

  const statusBadge = (s: string | null) =>
    s === "publicada" ? <Badge>Publicada</Badge> : s === "arquivada" ? <Badge variant="secondary">Arquivada</Badge> : <Badge variant="outline">Rascunho</Badge>;

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calculator className="w-6 h-6 text-primary"/>Motor de Cálculos</h1>
        <p className="text-muted-foreground text-sm">Repositório central das fórmulas nutricionais (N180, N32, NPK, K180, P180, Foliar etc.)</p>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Fórmulas</p><p className="text-2xl font-bold">{formulas.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Regras</p><p className="text-2xl font-bold">{counts.regras}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Limites de sais</p><p className="text-2xl font-bold">{counts.limites}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Níveis de dose</p><p className="text-2xl font-bold">{counts.doses}</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="outline"><Link to="/app/gestao/importacoes"><FileSpreadsheet className="w-4 h-4 mr-1"/>Importar Excel</Link></Button>
        <Button asChild variant="outline"><Link to="/app/nutrir/formulacoes">Ver formulações</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Fórmulas cadastradas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Código</th><th className="text-left px-4 py-2">Nome</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Atualizada</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr> :
                 formulas.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhuma fórmula. Importe a planilha-base em <Link to="/app/gestao/importacoes" className="underline text-primary">Importações</Link>.</td></tr> :
                 formulas.map(f => (
                  <tr key={f.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{f.codigo ?? "—"}</td>
                    <td className="px-4 py-2 font-medium">{f.nome}</td>
                    <td className="px-4 py-2">{statusBadge(f.status)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-1"><History className="w-3 h-3"/>{new Date(f.updated_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
