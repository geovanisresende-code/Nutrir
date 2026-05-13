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

interface Regional { id: string; nome: string; uf: string | null; descricao: string | null; custo_adicional_litro: number; ativo: boolean; }

export default function Regionais() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<Regional>("nutrir_regionais", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Regional> | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!current || !edit?.nome) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      organization_id: current.id, nome: edit.nome, uf: edit.uf || null, descricao: edit.descricao || null,
      custo_adicional_litro: edit.custo_adicional_litro ?? 0, ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_regionais").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_regionais").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Criada" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta regional?")) return;
    const { error } = await (supabase as any).from("nutrir_regionais").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Excluída" }); reload();
  };

  return (
    <>
      <CrudList
        title="Regionais" description="Áreas comerciais com custo adicional por litro"
        data={data} loading={loading} searchKeys={["nome","uf"]}
        headers={["Nome","UF","Custo adic. R$/L","Ativo","Ações"]}
        onNew={() => { setEdit({ ativo: true, custo_adicional_litro: 0 }); setOpen(true); }}
        renderRow={(r) => (<>
          <td className="px-4 py-2 font-medium">{r.nome}</td>
          <td className="px-4 py-2">{r.uf ?? "—"}</td>
          <td className="px-4 py-2">R$ {Number(r.custo_adicional_litro).toFixed(4)}</td>
          <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
          <td className="px-4 py-2">
            <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="w-4 h-4"/></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
          </td>
        </>)}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar regional" : "Nova regional"} onSave={onSave} saving={saving}>
        <Field label="Nome *"><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
        <Field label="UF"><Input value={edit?.uf ?? ""} onChange={e => setEdit({ ...edit, uf: e.target.value })} maxLength={2}/></Field>
        <Field label="Descrição"><Input value={edit?.descricao ?? ""} onChange={e => setEdit({ ...edit, descricao: e.target.value })}/></Field>
        <Field label="Custo adicional por litro (R$)">
          <Input type="number" step="0.0001" value={edit?.custo_adicional_litro ?? 0} onChange={e => setEdit({ ...edit, custo_adicional_litro: parseFloat(e.target.value) || 0 })}/>
        </Field>
        <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
      </FormDialog>
    </>
  );
}
