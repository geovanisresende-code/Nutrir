import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2 } from "lucide-react";
import { CrudList } from "@/components/nutrir/CrudList";
import { FormDialog, Field } from "@/components/nutrir/FormDialog";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface MP { id: string; codigo: string | null; nome: string; fornecedor: string | null; preco_atual: number | null; unidade_preco: string; observacoes: string | null; ativo: boolean; }

// Catálogo baseado na planilha C.M.P (Cristiano / Fertagro)
const CATALOGO_PADRAO = [
  // ── MACROS ──
  { codigo: "URB", nome: "Ureia",              preco_atual: 3.40,  observacoes: "45% N" },
  { codigo: "MAP", nome: "MAP Purificado",     preco_atual: 8.20,  observacoes: "60% P2O5 · 12% N" },
  { codigo: "KCB", nome: "KCl Branco",         preco_atual: 3.40,  observacoes: "60% K2O" },
  { codigo: "KCV", nome: "KCl Vermelho",        preco_atual: 2.80,  observacoes: "60% K2O" },
  { codigo: "SFA", nome: "Sulfato de Amônio",  preco_atual: 2.08,  observacoes: "21% N · 24% S" },
  { codigo: "NTA", nome: "Nitrato de Amônio",  preco_atual: 2.30,  observacoes: "33% N" },
  { codigo: "SSI", nome: "Super Simples",      preco_atual: 1.50,  observacoes: "18% P2O5 · 10% S" },
  { codigo: "MAG", nome: "MAP Granulado",      preco_atual: 3.00,  observacoes: "48% P2O5 · 10% N" },
  { codigo: "FRR", nome: "Fosfato Reativo",    preco_atual: 1.80,  observacoes: "28% P2O5" },
  { codigo: "FRM", nome: "Formulado NPK",      preco_atual: 2.50,  observacoes: "NPK formulado" },
  // ── MICROS ──
  { codigo: "SMN", nome: "Sulfato de Manganês", preco_atual: 5.15,  observacoes: "31% Mn" },
  { codigo: "SMG", nome: "Sulfato de Magnésio", preco_atual: 5.20,  observacoes: "16% Mg" },
  { codigo: "SZN", nome: "Sulfato de Zinco",    preco_atual: 9.00,  observacoes: "35% Zn" },
  { codigo: "SCU", nome: "Sulfato de Cobre",    preco_atual: 32.0,  observacoes: "35% Cu" },
  { codigo: "ACB", nome: "Ácido Bórico",        preco_atual: 6.50,  observacoes: "17% B" },
  { codigo: "MON", nome: "Molibdato de Sódio",  preco_atual: 142.,  observacoes: "39% Mo" },
  { codigo: "SCO", nome: "Sulfato de Cobalto",  preco_atual: 62.0,  observacoes: "20% Co" },
  { codigo: "SNI", nome: "Sulfato de Níquel",   preco_atual: 48.0,  observacoes: "22% Ni" },
  { codigo: "SSE", nome: "Selenito de Sódio",   preco_atual: 130.,  observacoes: "44% Se" },
  { codigo: "NCA", nome: "Nitrato de Cálcio",   preco_atual: 5.50,  observacoes: "16% Ca · 15,5% N" },
  { codigo: "SKP", nome: "Silicato de Potássio",preco_atual: 65.0,  observacoes: "42% Si" },
  { codigo: "SFC", nome: "Sulfato Férrico",     preco_atual: 45.0,  observacoes: "23% Fe" },
];

export default function MateriasPrimas() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<MP>("nutrir_materias_primas", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<MP> | null>(null);
  const [saving, setSaving] = useState(false);

  const codigosExistentes = new Set(data.map(r => r.codigo ?? ""));
  const faltando = CATALOGO_PADRAO.filter(r => !codigosExistentes.has(r.codigo));
  const catalogoCompleto = faltando.length === 0;

  const onSave = async () => {
    if (!current || !edit?.nome) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      organization_id: current.id, codigo: edit.codigo || null, nome: edit.nome,
      fornecedor: edit.fornecedor || null, preco_atual: edit.preco_atual ?? null,
      unidade_preco: edit.unidade_preco ?? "kg", observacoes: edit.observacoes || null, ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_materias_primas").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_materias_primas").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Cadastrada" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir matéria-prima?")) return;
    await (supabase as any).from("nutrir_materias_primas").delete().eq("id", id); reload();
  };

  const seedItens = async (itens: typeof CATALOGO_PADRAO, msg: string) => {
    if (!current) return;
    const rows = itens.map(r => ({
      ...r, unidade_preco: "kg", ativo: true,
      organization_id: current.id, fornecedor: null,
    }));
    const { error } = await (supabase as any).from("nutrir_materias_primas").insert(rows);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: msg }); reload(); }
  };

  const toolbar = data.length === 0
    ? (
      <Button variant="outline" onClick={() => seedItens(CATALOGO_PADRAO, `✅ ${CATALOGO_PADRAO.length} matérias-primas inseridas!`)}>
        ✨ Popular catálogo ({CATALOGO_PADRAO.length} itens)
      </Button>
    )
    : !catalogoCompleto
    ? (
      <Button variant="outline" onClick={() => seedItens(faltando, `✅ ${faltando.length} itens adicionados!`)}>
        ➕ Completar catálogo ({faltando.length} faltando)
      </Button>
    )
    : undefined;

  return (
    <>
      <CrudList
        title="Matérias-primas" description="Insumos para formulações"
        data={data} loading={loading} searchKeys={["nome","codigo","fornecedor"]}
        headers={["Código","Nome","Fornecedor","Preço","Ativo","Ações"]}
        onNew={() => { setEdit({ ativo: true, unidade_preco: "kg" }); setOpen(true); }}
        toolbar={toolbar}
        renderRow={(r) => (<>
          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.codigo ?? "—"}</td>
          <td className="px-4 py-2 font-medium">{r.nome}</td>
          <td className="px-4 py-2">{r.fornecedor ?? "—"}</td>
          <td className="px-4 py-2">{r.preco_atual != null ? `R$ ${Number(r.preco_atual).toFixed(4)}/${r.unidade_preco}` : "—"}</td>
          <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
          <td className="px-4 py-2">
            <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="w-4 h-4"/></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
          </td>
        </>)}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar matéria-prima" : "Nova matéria-prima"} onSave={onSave} saving={saving} maxW="max-w-xl">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Código"><Input value={edit?.codigo ?? ""} onChange={e => setEdit({ ...edit, codigo: e.target.value })}/></Field>
          <Field label="Nome *" span={2}><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
        </div>
        <Field label="Fornecedor"><Input value={edit?.fornecedor ?? ""} onChange={e => setEdit({ ...edit, fornecedor: e.target.value })}/></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço"><Input type="number" step="0.0001" value={edit?.preco_atual ?? ""} onChange={e => setEdit({ ...edit, preco_atual: parseFloat(e.target.value) || null })}/></Field>
          <Field label="Unidade preço"><Input value={edit?.unidade_preco ?? "kg"} onChange={e => setEdit({ ...edit, unidade_preco: e.target.value })}/></Field>
        </div>
        <Field label="Observações"><Textarea rows={2} value={edit?.observacoes ?? ""} onChange={e => setEdit({ ...edit, observacoes: e.target.value })}/></Field>
        <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
      </FormDialog>
    </>
  );
}
