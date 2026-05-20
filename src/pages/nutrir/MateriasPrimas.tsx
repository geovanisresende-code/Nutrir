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

// Catálogo completo de matérias-primas padrão (~27 itens)
const CATALOGO_PADRAO = [
  // ── Fontes de Nitrogênio ──
  { codigo: "URB", nome: "Ureia Branca",          preco_atual: 2.20, observacoes: "45% N" },
  { codigo: "URP", nome: "Ureia Protegida",        preco_atual: 4.20, observacoes: "45% N revestida" },
  { codigo: "SFA", nome: "Sulfato de Amônio",      preco_atual: 1.80, observacoes: "21% N · 24% S" },
  { codigo: "NTA", nome: "Nitrato de Amônio",      preco_atual: 3.20, observacoes: "33% N" },
  { codigo: "KNO", nome: "Nitrato de Potássio",    preco_atual: 3.80, observacoes: "13% N · 44% K2O" },
  { codigo: "NCA", nome: "Nitrato de Cálcio",      preco_atual: 3.50, observacoes: "15,5% N · 26% Ca" },
  // ── Fontes de Fósforo ──
  { codigo: "MAP", nome: "MAP Purificado",         preco_atual: 4.50, observacoes: "12% N · 60% P2O5" },
  { codigo: "DAP", nome: "Fosfato Diamônico",      preco_atual: 4.00, observacoes: "18% N · 46% P2O5" },
  { codigo: "MKP", nome: "Fosfato Monopotássico",  preco_atual: 8.00, observacoes: "52% P2O5 · 34% K2O" },
  // ── Fontes de Potássio ──
  { codigo: "KCL", nome: "KCl Branco",             preco_atual: 2.80, observacoes: "60% K2O" },
  { codigo: "SOP", nome: "Sulfato de Potássio",    preco_atual: 5.50, observacoes: "50% K2O · 18% S" },
  { codigo: "SKP", nome: "Silicato de Potássio",   preco_atual: 6.50, observacoes: "30% Si · 35% K2O" },
  // ── Cálcio ──
  { codigo: "CCA", nome: "Cloreto de Cálcio",      preco_atual: 2.20, observacoes: "27% Ca" },
  // ── Boro ──
  { codigo: "ACB", nome: "Ácido Bórico",           preco_atual: 18.0, observacoes: "17% B" },
  { codigo: "BRX", nome: "Bórax",                  preco_atual: 8.00, observacoes: "11% B" },
  // ── Micronutrientes ──
  { codigo: "SMN", nome: "Sulfato de Manganês",    preco_atual: 8.50, observacoes: "31% Mn" },
  { codigo: "SMG", nome: "Sulfato de Magnésio",    preco_atual: 3.50, observacoes: "10% Mg" },
  { codigo: "SZN", nome: "Sulfato de Zinco",       preco_atual: 9.00, observacoes: "22% Zn" },
  { codigo: "SCU", nome: "Sulfato de Cobre",       preco_atual: 12.0, observacoes: "25% Cu" },
  { codigo: "SFE", nome: "Sulfato Ferroso",        preco_atual: 4.00, observacoes: "20% Fe" },
  { codigo: "SFC", nome: "Sulfato Férrico",        preco_atual: 6.00, observacoes: "19% Fe" },
  { codigo: "QFE", nome: "Quelato de Ferro EDTA",  preco_atual: 28.0, observacoes: "6% Fe quelado" },
  { codigo: "SCO", nome: "Sulfato de Cobalto",     preco_atual: 85.0, observacoes: "21% Co" },
  { codigo: "MOL", nome: "Molibdato de Amônio",    preco_atual: 45.0, observacoes: "54% Mo" },
  { codigo: "MON", nome: "Molibdato de Sódio",     preco_atual: 90.0, observacoes: "39% Mo" },
  { codigo: "SNI", nome: "Sulfato de Níquel",      preco_atual: 65.0, observacoes: "22% Ni" },
  { codigo: "SSE", nome: "Selenito de Sódio",      preco_atual: 200., observacoes: "45% Se" },
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
        ✨ Popular catálogo completo ({CATALOGO_PADRAO.length} itens)
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
