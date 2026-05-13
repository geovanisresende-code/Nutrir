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

export default function MateriasPrimas() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<MP>("nutrir_materias_primas", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<MP> | null>(null);
  const [saving, setSaving] = useState(false);

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

  return (
    <>
      <CrudList
        title="Matérias-primas" description="Insumos para formulações"
        data={data} loading={loading} searchKeys={["nome","codigo","fornecedor"]}
        headers={["Código","Nome","Fornecedor","Preço","Ativo","Ações"]}
        onNew={() => { setEdit({ ativo: true, unidade_preco: "kg" }); setOpen(true); }}
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
