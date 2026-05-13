import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/nutrir/precos-engine";

interface Produto { id: string; nome: string; codigo: string | null; categoria: string | null; custo_industria: number | null; }
interface Embalagem { id: string; nome: string; volume: number | null; }
interface Regional { id: string; nome: string; uf: string | null; }
interface Modalidade { id: string; nome: string; tipo: string | null; }
interface Preco {
  id: string; produto_id: string; embalagem_id: string | null;
  regional_id: string | null; modalidade_id: string | null;
  preco: number; vigencia_inicio: string; vigencia_fim: string | null; ativo: boolean;
}

export default function Precos() {
  const { current } = useOrg();
  const { data: produtos } = useOrgTable<Produto>("nutrir_produtos", { orderBy: "nome" });
  const { data: embalagens } = useOrgTable<Embalagem>("nutrir_embalagens", { orderBy: "nome" });
  const { data: regionais } = useOrgTable<Regional>("nutrir_regionais", { orderBy: "nome" });
  const { data: modalidades } = useOrgTable<Modalidade>("nutrir_modalidades", { orderBy: "nome" });
  const { data: precos, loading, reload } = useOrgTable<Preco>("nutrir_precos", { orderBy: "created_at", ascending: false });

  const [filtro, setFiltro] = useState<{ produto?: string; regional?: string; modalidade?: string }>({});
  const [novo, setNovo] = useState<Partial<Preco>>({ ativo: true });
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => precos.filter(p =>
    (!filtro.produto || p.produto_id === filtro.produto) &&
    (!filtro.regional || p.regional_id === filtro.regional) &&
    (!filtro.modalidade || p.modalidade_id === filtro.modalidade)
  ), [precos, filtro]);

  const adicionar = async () => {
    if (!current || !novo.produto_id || !novo.preco) {
      toast({ title: "Produto e preço obrigatórios", variant: "destructive" }); return;
    }
    setSalvando(true);
    const { error } = await (supabase as any).from("nutrir_precos").insert({
      organization_id: current.id,
      produto_id: novo.produto_id,
      embalagem_id: novo.embalagem_id || null,
      regional_id: novo.regional_id || null,
      modalidade_id: novo.modalidade_id || null,
      preco: novo.preco,
      vigencia_inicio: novo.vigencia_inicio || new Date().toISOString().slice(0, 10),
      vigencia_fim: novo.vigencia_fim || null,
      ativo: novo.ativo ?? true,
    });
    setSalvando(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Preço adicionado" });
    setNovo({ ativo: true });
    reload();
  };

  const atualizarInline = async (id: string, patch: Partial<Preco>) => {
    const { error } = await (supabase as any).from("nutrir_precos").update(patch).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    reload();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir preço?")) return;
    await (supabase as any).from("nutrir_precos").delete().eq("id", id);
    reload();
  };

  const nome = (id: string | null | undefined, lst: any[]) => lst.find(x => x.id === id)?.nome ?? "—";

  return (
    <>
      <PageHeader
        title="Tabela de Preços"
        description="Matriz produto × regional × modalidade × embalagem"
      />
      <div className="p-4 md:p-6 space-y-4">
        {/* Filtros */}
        <Card className="p-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Produto</label>
              <Select value={filtro.produto ?? "all"} onValueChange={v => setFiltro({ ...filtro, produto: v === "all" ? undefined : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Regional</label>
              <Select value={filtro.regional ?? "all"} onValueChange={v => setFiltro({ ...filtro, regional: v === "all" ? undefined : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as regionais</SelectItem>
                  {regionais.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Modalidade</label>
              <Select value={filtro.modalidade ?? "all"} onValueChange={v => setFiltro({ ...filtro, modalidade: v === "all" ? undefined : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as modalidades</SelectItem>
                  {modalidades.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Adicionar novo preço */}
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-primary"/>
            <h3 className="font-semibold">Adicionar preço</h3>
          </div>
          <div className="grid md:grid-cols-7 gap-2">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Produto *</label>
              <Select value={novo.produto_id ?? ""} onValueChange={v => setNovo({ ...novo, produto_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                <SelectContent>{produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Embalagem</label>
              <Select value={novo.embalagem_id ?? "none"} onValueChange={v => setNovo({ ...novo, embalagem_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— qualquer —</SelectItem>
                  {embalagens.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Regional</label>
              <Select value={novo.regional_id ?? "none"} onValueChange={v => setNovo({ ...novo, regional_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— todas —</SelectItem>
                  {regionais.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Modalidade</label>
              <Select value={novo.modalidade_id ?? "none"} onValueChange={v => setNovo({ ...novo, modalidade_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— todas —</SelectItem>
                  {modalidades.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Preço (R$) *</label>
              <Input type="number" step="0.01" value={novo.preco ?? ""} onChange={e => setNovo({ ...novo, preco: parseFloat(e.target.value) || 0 })}/>
            </div>
            <div className="flex items-end">
              <Button onClick={adicionar} disabled={salvando} className="w-full"><Plus className="w-4 h-4 mr-1"/>Adicionar</Button>
            </div>
          </div>
        </Card>

        {/* Lista */}
        <Card className="overflow-x-auto"><div className="min-w-[640px]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Produto</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Embalagem</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Regional</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Modalidade</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Preço</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vigência</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ativo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
                : lista.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum preço cadastrado</td></tr>
                : lista.map(p => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{nome(p.produto_id, produtos)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{nome(p.embalagem_id, embalagens)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{nome(p.regional_id, regionais)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{nome(p.modalidade_id, modalidades)}</td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" step="0.01" defaultValue={p.preco} className="w-28 text-right ml-auto"
                        onBlur={e => { const v = parseFloat(e.target.value); if (v && v !== p.preco) atualizarInline(p.id, { preco: v }); }}/>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(p.vigencia_inicio).toLocaleDateString("pt-BR")}
                      {p.vigencia_fim && ` – ${new Date(p.vigencia_fim).toLocaleDateString("pt-BR")}`}
                    </td>
                    <td className="px-3 py-2">
                      <Switch checked={p.ativo} onCheckedChange={v => atualizarInline(p.id, { ativo: v })}/>
                    </td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon" onClick={() => excluir(p.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </Card>
      </div>
    </>
  );
}
