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

interface F { id: string; codigo: string|null; nome: string; descricao: string|null; rendimento_total: number|null; unidade_rendimento: string|null; custo_estimado: number|null; ativo: boolean; }

export default function Formulacoes() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<F>("nutrir_formulacoes", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<F>|null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!current || !edit?.nome) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      organization_id: current.id, codigo: edit.codigo||null, nome: edit.nome, descricao: edit.descricao||null,
      rendimento_total: edit.rendimento_total ?? null, unidade_rendimento: edit.unidade_rendimento ?? "kg",
      custo_estimado: edit.custo_estimado ?? null, ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_formulacoes").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_formulacoes").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Cadastrada" });
    setOpen(false); setEdit(null); reload();
  };

  return (
    <>
      <CrudList
        title="Formulações" description="Composições de matérias-primas"
        data={data} loading={loading} searchKeys={["nome","codigo"]}
        headers={["Código","Nome","Rendimento","Custo estimado","Ativo","Ações"]}
        onNew={() => { setEdit({ ativo: true, unidade_rendimento: "kg" }); setOpen(true); }}
        renderRow={(r) => (<>
          <td className="px-4 py-2 font-mono text-xs">{r.codigo ?? "—"}</td>
          <td className="px-4 py-2 font-medium">{r.nome}</td>
          <td className="px-4 py-2">{r.rendimento_total ? `${r.rendimento_total} ${r.unidade_rendimento ?? ""}` : "—"}</td>
          <td className="px-4 py-2">{r.custo_estimado != null ? `R$ ${Number(r.custo_estimado).toFixed(2)}` : "—"}</td>
          <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
          <td className="px-4 py-2">
            <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="w-4 h-4"/></Button>
            <Button variant="ghost" size="icon" onClick={async () => { if (confirm("Excluir?")) { await (supabase as any).from("nutrir_formulacoes").delete().eq("id", r.id); reload(); } }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
          </td>
        </>)}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar formulação" : "Nova formulação"} onSave={onSave} saving={saving} maxW="max-w-xl">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Código"><Input value={edit?.codigo ?? ""} onChange={e => setEdit({ ...edit, codigo: e.target.value })}/></Field>
          <Field label="Nome *" span={2}><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
        </div>
        <Field label="Descrição"><Textarea rows={2} value={edit?.descricao ?? ""} onChange={e => setEdit({ ...edit, descricao: e.target.value })}/></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Rendimento"><Input type="number" step="0.001" value={edit?.rendimento_total ?? ""} onChange={e => setEdit({ ...edit, rendimento_total: parseFloat(e.target.value)||null })}/></Field>
          <Field label="Unidade"><Input value={edit?.unidade_rendimento ?? "kg"} onChange={e => setEdit({ ...edit, unidade_rendimento: e.target.value })}/></Field>
          <Field label="Custo (R$)"><Input type="number" step="0.0001" value={edit?.custo_estimado ?? ""} onChange={e => setEdit({ ...edit, custo_estimado: parseFloat(e.target.value)||null })}/></Field>
        </div>
        <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
      </FormDialog>
    </>
  );
}
