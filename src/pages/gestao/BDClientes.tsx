import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Download, Search } from "lucide-react";

type Cliente = {
  id: string; razao_social: string; nome_fantasia: string | null; cpf_cnpj: string | null;
  categoria: string | null; cidade: string | null; uf: string | null; representante_id: string | null;
  regional_id: string | null; situacao: string | null; created_at: string;
};

export default function BDClientes() {
  const { current } = useOrg();
  const [data, setData] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from("nutrir_clientes").select("*").eq("organization_id", current.id).order("razao_social").limit(2000);
      setData(data ?? []);
      setLoading(false);
    })();
  }, [current?.id]);

  const filtered = data.filter(c => {
    const s = q.toLowerCase();
    return !s || c.razao_social?.toLowerCase().includes(s) || c.cpf_cnpj?.includes(s) || c.cidade?.toLowerCase().includes(s);
  });

  const exportCSV = () => {
    const rows = [["Razão Social", "CNPJ/CPF", "Categoria", "Cidade", "UF", "Situação"]];
    filtered.forEach(c => rows.push([c.razao_social, c.cpf_cnpj ?? "", c.categoria ?? "", c.cidade ?? "", c.uf ?? "", c.situacao ?? ""]));
    const csv = rows.map(r => r.map(v => `"${(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `clientes_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="w-6 h-6 text-primary"/>Banco de Dados de Clientes</h1>
          <p className="text-muted-foreground text-sm">Visão consolidada (administrativa) de todos os clientes da organização.</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}><Download className="w-4 h-4 mr-1"/>Exportar CSV</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
        <Input className="pl-9" placeholder="Buscar por nome, CNPJ ou cidade…" value={q} onChange={e => setQ(e.target.value)}/>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr><th className="text-left px-4 py-2">Razão Social</th><th className="text-left px-4 py-2">CNPJ/CPF</th><th className="text-left px-4 py-2">Categoria</th><th className="text-left px-4 py-2">Cidade/UF</th><th className="text-left px-4 py-2">Situação</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr> :
                 filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum cliente cadastrado.</td></tr> :
                 filtered.map(c => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{c.razao_social}{c.nome_fantasia && <span className="text-muted-foreground text-xs ml-1">({c.nome_fantasia})</span>}</td>
                    <td className="px-4 py-2 font-mono text-xs">{c.cpf_cnpj ?? "—"}</td>
                    <td className="px-4 py-2">{c.categoria ? <Badge variant="outline">{c.categoria}</Badge> : "—"}</td>
                    <td className="px-4 py-2">{c.cidade ?? "—"}{c.uf && `/${c.uf}`}</td>
                    <td className="px-4 py-2">{c.situacao === "ativo" ? <Badge>Ativo</Badge> : <Badge variant="secondary">{c.situacao ?? "—"}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t text-xs text-muted-foreground">{filtered.length} de {data.length} clientes</div>
        </CardContent>
      </Card>
    </div>
  );
}
