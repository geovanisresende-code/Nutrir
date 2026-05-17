import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, ChevronDown, Package as PackageIcon, Search, Eye } from "lucide-react";
import { FormDialog, Field } from "@/components/nutrir/FormDialog";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtBRL } from "@/lib/nutrir/format";
import { cn } from "@/lib/utils";

interface Produto {
  id: string; codigo: string | null; nome: string; classificacao: string | null;
  categoria: "DIAMANTE"|"OURO"|"PRATA"|"BRONZE"|null;
  linha: string | null; descricao: string | null; modo_aplicacao: string | null;
  dose_recomendada: string | null; recomendacao_uso: string | null;
  custo_industria: number | null; observacoes: string | null; ativo: boolean;
}

const CATEGORIAS = ["DIAMANTE","OURO","PRATA","BRONZE"] as const;
const CAT_COLORS: Record<string,string> = {
  DIAMANTE:"bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  OURO:"bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  PRATA:"bg-zinc-400/20 text-zinc-700 dark:text-zinc-200",
  BRONZE:"bg-orange-500/15 text-orange-700 dark:text-orange-300",
};

const SEM_LINHA = "— Sem linha —";

export default function Produtos() {
  const navigate = useNavigate();
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<Produto>("nutrir_produtos", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Produto> | null>(null);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");
  const [colapsadas, setColapsadas] = useState<Record<string, boolean>>({});

  const onSave = async () => {
    if (!current || !edit?.nome) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      organization_id: current.id,
      codigo: edit.codigo || null, nome: edit.nome, classificacao: edit.classificacao || null,
      categoria: edit.categoria || null, linha: edit.linha || null, descricao: edit.descricao || null,
      modo_aplicacao: edit.modo_aplicacao || null, dose_recomendada: edit.dose_recomendada || null,
      recomendacao_uso: edit.recomendacao_uso || null, custo_industria: edit.custo_industria ?? null,
      observacoes: edit.observacoes || null, ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_produtos").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_produtos").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Cadastrado" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    await (supabase as any).from("nutrir_produtos").delete().eq("id", id); reload();
  };

  // Agrupa produtos por linha
  const grupos = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    const filtrados = filtro
      ? data.filter(p =>
          (p.nome ?? "").toLowerCase().includes(filtro) ||
          (p.codigo ?? "").toLowerCase().includes(filtro) ||
          (p.linha ?? "").toLowerCase().includes(filtro))
      : data;
    const map = new Map<string, Produto[]>();
    for (const p of filtrados) {
      const key = (p.linha?.trim() || SEM_LINHA);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === SEM_LINHA) return 1;
      if (b === SEM_LINHA) return -1;
      return a.localeCompare(b, "pt-BR");
    });
  }, [data, busca]);

  const toggle = (linha: string) =>
    setColapsadas(c => ({ ...c, [linha]: !c[linha] }));

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Catálogo organizado por linha de produto"
        actions={
          <Button onClick={() => { setEdit({ ativo: true }); setOpen(true); }} className="bg-gradient-primary">
            <Plus className="w-4 h-4 mr-1" />Novo produto
          </Button>
        }
      />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, código ou linha…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
        </div>

        {loading && <div className="text-sm text-muted-foreground">Carregando…</div>}

        {!loading && grupos.length === 0 && (
          <div className="text-sm text-muted-foreground border rounded-md p-8 text-center">
            Nenhum produto encontrado.
          </div>
        )}

        {grupos.map(([linha, produtos]) => {
          const fechado = !!colapsadas[linha];
          return (
            <div key={linha} className="border rounded-lg overflow-hidden bg-card">
              <button
                onClick={() => toggle(linha)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown className={cn("h-4 w-4 transition", fechado && "-rotate-90")} />
                  <PackageIcon className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{linha}</span>
                  <Badge variant="secondary" className="ml-1">{produtos.length}</Badge>
                </div>
              </button>
              {!fechado && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background border-b text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">Código</th>
                        <th className="px-4 py-2 text-left">Nome</th>
                        <th className="px-4 py-2 text-left">Categoria</th>
                        <th className="px-4 py-2 text-left">Custo Indústria (R$)</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map(r => (
                        <tr key={r.id} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{r.codigo ?? "—"}</td>
                          <td className="px-4 py-2 font-medium">{r.nome}</td>
                          <td className="px-4 py-2">
                            {r.categoria
                              ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${CAT_COLORS[r.categoria]}`}>{r.categoria}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-2 font-mono">
                            {r.custo_industria != null ? fmtBRL(Number(r.custo_industria)) : "—"}
                          </td>
                          <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                          <td className="px-4 py-2 text-right">
                            <Button variant="ghost" size="icon" title="Ver ficha técnica" onClick={() => navigate(`/app/nutrir/produto/${r.id}`)}>
                              <Eye className="w-4 h-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar produto" : "Novo produto"} onSave={onSave} saving={saving} maxW="max-w-2xl">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Código"><Input value={edit?.codigo ?? ""} onChange={e => setEdit({ ...edit, codigo: e.target.value })}/></Field>
          <Field label="Nome *" span={2}><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <Select value={edit?.categoria ?? "none"} onValueChange={v => setEdit({ ...edit, categoria: v === "none" ? null : v as any })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem categoria —</SelectItem>
                {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Linha">
            <Input
              placeholder="Ex.: Foliar, Solo, Bio…"
              value={edit?.linha ?? ""}
              onChange={e => setEdit({ ...edit, linha: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Classificação"><Input value={edit?.classificacao ?? ""} onChange={e => setEdit({ ...edit, classificacao: e.target.value })}/></Field>
          <Field label="Custo indústria (R$)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input className="pl-9" type="number" step="0.0001" value={edit?.custo_industria ?? ""} onChange={e => setEdit({ ...edit, custo_industria: parseFloat(e.target.value) || null })}/>
            </div>
          </Field>
        </div>
        <Field label="Modo de aplicação"><Input value={edit?.modo_aplicacao ?? ""} onChange={e => setEdit({ ...edit, modo_aplicacao: e.target.value })}/></Field>
        <Field label="Dose recomendada (gr/ha · L/ha · kg/ha)">
          <Input placeholder="Ex.: 500 gr/ha" value={edit?.dose_recomendada ?? ""} onChange={e => setEdit({ ...edit, dose_recomendada: e.target.value })}/>
        </Field>
        <Field label="Descrição"><Textarea rows={2} value={edit?.descricao ?? ""} onChange={e => setEdit({ ...edit, descricao: e.target.value })}/></Field>
        <Field label="Recomendação de uso"><Textarea rows={2} value={edit?.recomendacao_uso ?? ""} onChange={e => setEdit({ ...edit, recomendacao_uso: e.target.value })}/></Field>
        <Field label="Observações"><Textarea rows={2} value={edit?.observacoes ?? ""} onChange={e => setEdit({ ...edit, observacoes: e.target.value })}/></Field>
        <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
      </FormDialog>
    </>
  );
}
