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

interface Modalidade { id: string; nome: string; descricao: string | null; prazo_dias: number | null; tipo: string | null; margens_por_categoria: any; ativo: boolean; }

export default function Modalidades() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<Modalidade>("nutrir_modalidades", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Modalidade> | null>(null);
  const [saving, setSaving] = useState(false);
  const [margensJson, setMargensJson] = useState("{}");

  const handleNew = () => { setEdit({ ativo: true, margens_por_categoria: {} }); setMargensJson("{}"); setOpen(true); };
  const handleEdit = (r: Modalidade) => { setEdit(r); setMargensJson(JSON.stringify(r.margens_por_categoria ?? {}, null, 2)); setOpen(true); };

  const onSave = async () => {
    if (!current || !edit?.nome) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    let margens: any = {};
    try { margens = JSON.parse(margensJson || "{}"); } catch { toast({ title: "JSON inválido em margens", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      organization_id: current.id, nome: edit.nome, descricao: edit.descricao || null,
      prazo_dias: edit.prazo_dias ?? null, tipo: edit.tipo || null,
      margens_por_categoria: margens, ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_modalidades").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_modalidades").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Criada" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await (supabase as any).from("nutrir_modalidades").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    reload();
  };

  return (
    <>
      <CrudList
        title="Modalidades" description="Modalidades de pagamento e margens por categoria de produto"
        data={data} loading={loading} searchKeys={["nome","tipo"]}
        headers={["Nome","Tipo","Prazo (dias)","Margens","Ativo","Ações"]}
        onNew={handleNew}
        renderRow={(r) => (<>
          <td className="px-4 py-2 font-medium">{r.nome}</td>
          <td className="px-4 py-2">{r.tipo ?? "—"}</td>
          <td className="px-4 py-2">{r.prazo_dias ?? "—"}</td>
          <td className="px-4 py-2 text-xs text-muted-foreground">{Object.keys(r.margens_por_categoria ?? {}).length} categorias</td>
          <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
          <td className="px-4 py-2">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Pencil className="w-4 h-4"/></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
          </td>
        </>)}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar modalidade" : "Nova modalidade"} onSave={onSave} saving={saving}>
        <Field label="Nome *"><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
        <Field label="Tipo"><Input value={edit?.tipo ?? ""} onChange={e => setEdit({ ...edit, tipo: e.target.value })} placeholder="ex: à vista, parcelado"/></Field>
        <Field label="Prazo (dias)"><Input type="number" value={edit?.prazo_dias ?? ""} onChange={e => setEdit({ ...edit, prazo_dias: parseInt(e.target.value) || null })}/></Field>
        <Field label="Descrição"><Input value={edit?.descricao ?? ""} onChange={e => setEdit({ ...edit, descricao: e.target.value })}/></Field>
        <Field label="Margens por categoria (JSON)">
          <Textarea value={margensJson} onChange={e => setMargensJson(e.target.value)} rows={5} className="font-mono text-xs" placeholder='{"DIAMANTE":0.25,"OURO":0.20,"PRATA":0.15,"BRONZE":0.10}'/>
        </Field>
        <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
      </FormDialog>
    </>
  );
}
