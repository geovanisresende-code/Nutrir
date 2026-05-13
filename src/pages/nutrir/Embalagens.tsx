import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";
import { CrudList } from "@/components/nutrir/CrudList";
import { FormDialog, Field } from "@/components/nutrir/FormDialog";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Embalagem { id: string; nome: string; volume: number | null; unidade: string; custo_adicional_litro: number; ativo: boolean; }

export default function Embalagens() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<Embalagem>("nutrir_embalagens", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Embalagem> | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!current || !edit?.nome) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      organization_id: current.id, nome: edit.nome, volume: edit.volume ?? null,
      unidade: edit.unidade ?? "L", custo_adicional_litro: edit.custo_adicional_litro ?? 0,
      ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_embalagens").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_embalagens").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Criada" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir?")) return;
    await (supabase as any).from("nutrir_embalagens").delete().eq("id", id); reload();
  };

  return (
    <>
      <CrudList
        title="Embalagens" data={data} loading={loading} searchKeys={["nome"]}
        headers={["Nome","Volume","Custo adic.","Ativo","Ações"]}
        onNew={() => { setEdit({ ativo: true, unidade: "L", custo_adicional_litro: 0 }); setOpen(true); }}
        renderRow={(r) => (<>
          <td className="px-4 py-2 font-medium">{r.nome}</td>
          <td className="px-4 py-2">{r.volume ? `${r.volume} ${r.unidade}` : "—"}</td>
          <td className="px-4 py-2">R$ {Number(r.custo_adicional_litro).toFixed(4)}</td>
          <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
          <td className="px-4 py-2">
            <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="w-4 h-4"/></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
          </td>
        </>)}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar embalagem" : "Nova embalagem"} onSave={onSave} saving={saving}>
        <Field label="Nome *"><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Volume"><Input type="number" step="0.001" value={edit?.volume ?? ""} onChange={e => setEdit({ ...edit, volume: parseFloat(e.target.value) || null })}/></Field>
          <Field label="Unidade"><Input value={edit?.unidade ?? "L"} onChange={e => setEdit({ ...edit, unidade: e.target.value })}/></Field>
        </div>
        <Field label="Custo adicional por litro (R$)"><Input type="number" step="0.0001" value={edit?.custo_adicional_litro ?? 0} onChange={e => setEdit({ ...edit, custo_adicional_litro: parseFloat(e.target.value) || 0 })}/></Field>
        <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
      </FormDialog>
    </>
  );
}
