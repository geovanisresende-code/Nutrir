import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sprout, Search, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Cultura = { id: string; nome: string; categoria: string; ciclo_dias: number | null; ativo: boolean };
type Estagio = { id: string; cultura_id: string; nome: string; ordem: number; descricao: string | null; periodo: string | null };
type Demanda = { cultura_id: string; nutriente_id: string; extracao_kg_ton: number; exportacao_kg_ton: number };
type Nutriente = { id: string; simbolo: string; nome: string };

export default function BDCulturas() {
  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [demanda, setDemanda] = useState<Demanda[]>([]);
  const [nuts, setNuts] = useState<Nutriente[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, e, d, n] = await Promise.all([
        supabase.from("nutrir_culturas").select("id,nome,categoria,ciclo_dias,ativo").eq("ativo", true).order("nome"),
        supabase.from("nutrir_estagios").select("id,cultura_id,nome,ordem,descricao,periodo").order("ordem"),
        supabase.from("nutrir_cultura_demanda").select("cultura_id,nutriente_id,extracao_kg_ton,exportacao_kg_ton"),
        supabase.from("nutrir_nutrientes").select("id,simbolo,nome"),
      ]);
      setCulturas((c.data as Cultura[]) || []);
      setEstagios((e.data as Estagio[]) || []);
      setDemanda((d.data as Demanda[]) || []);
      setNuts((n.data as Nutriente[]) || []);
      setLoading(false);
    })();
  }, []);

  const toggle = (id: string) => {
    const ns = new Set(open);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setOpen(ns);
  };

  const filtered = culturas.filter((c) => !q || c.nome.toLowerCase().includes(q.toLowerCase()));
  const grouped = new Map<string, Cultura[]>();
  for (const c of filtered) {
    const k = c.categoria || "Outras";
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(c);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sprout className="h-6 w-6 text-primary" />
            Banco de Dados de Culturas
          </h1>
          <p className="text-muted-foreground text-sm">{culturas.length} culturas · {estagios.length} estágios fenológicos</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cultura..." className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        Array.from(grouped.entries()).map(([cat, list]) => (
          <section key={cat} className="space-y-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {cat} <Badge variant="outline">{list.length}</Badge>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {list.map((c) => {
                const isOpen = open.has(c.id);
                const cEst = estagios.filter((s) => s.cultura_id === c.id);
                const cDem = demanda.filter((d) => d.cultura_id === c.id);
                return (
                  <Card key={c.id}>
                    <CardHeader className="cursor-pointer pb-2" onClick={() => toggle(c.id)}>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {c.nome}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {cEst.length} estágios · {cDem.length} nutrientes
                        </span>
                      </CardTitle>
                    </CardHeader>
                    {isOpen && (
                      <CardContent className="space-y-4 text-sm">
                        {cEst.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-1">Estágios fenológicos</h4>
                            <ol className="space-y-1">
                              {cEst.map((s) => (
                                <li key={s.id} className="flex gap-2">
                                  <Badge variant="outline" className="shrink-0">{s.nome}</Badge>
                                  <span className="text-muted-foreground">{s.descricao || s.periodo || ""}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {cDem.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-1">Extração / Exportação por tonelada</h4>
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr><th className="text-left">Nutriente</th><th className="text-right">Extração</th><th className="text-right">Exportação</th></tr>
                              </thead>
                              <tbody>
                                {cDem.map((d, i) => {
                                  const n = nuts.find((nn) => nn.id === d.nutriente_id);
                                  return (
                                    <tr key={i}>
                                      <td>{n?.simbolo || n?.nome || "—"}</td>
                                      <td className="text-right">{Number(d.extracao_kg_ton).toFixed(2)}</td>
                                      <td className="text-right">{Number(d.exportacao_kg_ton).toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
