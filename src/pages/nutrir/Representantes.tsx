import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
import { CrudList } from "@/components/nutrir/CrudList";
import { FormDialog, Field } from "@/components/nutrir/FormDialog";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Representante { id: string; nome: string; email: string | null; telefone: string | null; cpf: string | null; regional_id: string | null; comissao_percentual: number; ativo: boolean; }
interface Regional { id: string; nome: string; }

export default function Representantes() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<Representante>("nutrir_representantes", { orderBy: "nome" });
  const { data: regionais } = useOrgTable<Regional>("nutrir_regionais", { orderBy: "nome", select: "id,nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Representante> | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!current || !edit?.nome) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      organization_id: current.id, nome: edit.nome, email: edit.email || null, telefone: edit.telefone || null,
      cpf: edit.cpf || null, regional_id: edit.regional_id || null,
      comissao_percentual: edit.comissao_percentual ?? 0, ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_representantes").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_representantes").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Cadastrado" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir representante?")) return;
    await (supabase as any).from("nutrir_representantes").delete().eq("id", id); reload();
  };

  const regionalNome = (id: string | null) => regionais.find(r => r.id === id)?.nome ?? "—";

  return (
    <>
      <CrudList
        title="Representantes" description="Equipe comercial de campo"
        data={data} loading={loading} searchKeys={["nome","email","cpf"]}
        headers={["Nome","Email","Telefone","Regional","Comissão","Ativo","Ações"]}
        onNew={() => { setEdit({ ativo: true, comissao_percentual: 0 }); setOpen(true); }}
        renderRow={(r) => (<>
          <td className="px-4 py-2 font-medium">{r.nome}</td>
          <td className="px-4 py-2 text-muted-foreground">{r.email ?? "—"}</td>
          <td className="px-4 py-2">{r.telefone ?? "—"}</td>
          <td className="px-4 py-2">{regionalNome(r.regional_id)}</td>
          <td className="px-4 py-2">{Number(r.comissao_percentual).toFixed(2)}%</td>
          <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
          <td className="px-4 py-2">
            <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="w-4 h-4"/></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
          </td>
        </>)}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar representante" : "Novo representante"} onSave={onSave} saving={saving} maxW="max-w-xl">
        <Field label="Nome *"><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" value={edit?.email ?? ""} onChange={e => setEdit({ ...edit, email: e.target.value })}/></Field>
          <Field label="Telefone"><Input value={edit?.telefone ?? ""} onChange={e => setEdit({ ...edit, telefone: e.target.value })}/></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CPF"><Input value={edit?.cpf ?? ""} onChange={e => setEdit({ ...edit, cpf: e.target.value })}/></Field>
          <Field label="Comissão (%)"><Input type="number" step="0.01" value={edit?.comissao_percentual ?? 0} onChange={e => setEdit({ ...edit, comissao_percentual: parseFloat(e.target.value) || 0 })}/></Field>
        </div>
        <Field label="Regional">
          <Select value={edit?.regional_id ?? "none"} onValueChange={v => setEdit({ ...edit, regional_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem regional —</SelectItem>
              {regionais.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
      </FormDialog>
    </>
  );
}
