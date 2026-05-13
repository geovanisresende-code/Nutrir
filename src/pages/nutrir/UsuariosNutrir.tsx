import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudList } from "@/components/nutrir/CrudList";
import { FormDialog, Field } from "@/components/nutrir/FormDialog";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

interface NutrirUser {
  id: string; user_id: string | null; nome: string | null; email: string | null;
  telefone: string | null; role: "admin" | "gerente" | "consultor" | "vendedor"; ativo: boolean;
}

const ROLES = [
  { v: "admin", l: "Administrador", c: "destructive" },
  { v: "gerente", l: "Gerente", c: "default" },
  { v: "consultor", l: "Consultor", c: "default" },
  { v: "vendedor", l: "Vendedor", c: "secondary" },
] as const;

export default function UsuariosNutrir() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<NutrirUser>("nutrir_users", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<NutrirUser> | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!current || !edit?.email) { toast({ title: "Email obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    // Tenta resolver user_id via profile pelo email
    let userId = edit.user_id;
    if (!userId && edit.email) {
      const { data: prof } = await (supabase as any).from("profiles").select("id").eq("email", edit.email).maybeSingle();
      userId = prof?.id ?? null;
    }
    if (!userId) {
      toast({ title: "Usuário não encontrado", description: "O email precisa estar associado a uma conta cadastrada na plataforma.", variant: "destructive" });
      setSaving(false); return;
    }
    const payload: any = {
      organization_id: current.id, user_id: userId,
      nome: edit.nome || null, email: edit.email, telefone: edit.telefone || null,
      role: edit.role || "vendedor", ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_users").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_users").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Cadastrado" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remover usuário do programa Nutrir?")) return;
    await (supabase as any).from("nutrir_users").delete().eq("id", id); reload();
  };

  return (
    <>
      <CrudList
        title="Usuários Nutrir"
        description="Equipe comercial e consultiva (vendedor / consultor / gerente / admin)"
        data={data} loading={loading} searchKeys={["nome", "email"]}
        headers={["Nome", "Email", "Telefone", "Papel", "Ativo", "Ações"]}
        onNew={() => { setEdit({ ativo: true, role: "vendedor" }); setOpen(true); }}
        renderRow={(r) => {
          const role = ROLES.find(x => x.v === r.role);
          return (<>
            <td className="px-4 py-2 font-medium">{r.nome ?? "—"}</td>
            <td className="px-4 py-2 text-muted-foreground">{r.email ?? "—"}</td>
            <td className="px-4 py-2 text-muted-foreground">{r.telefone ?? "—"}</td>
            <td className="px-4 py-2"><Badge variant={role?.c as any}>{role?.l ?? r.role}</Badge></td>
            <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
            <td className="px-4 py-2">
              <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="w-4 h-4"/></Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
            </td>
          </>);
        }}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar usuário" : "Novo usuário"} onSave={onSave} saving={saving}>
        <Field label="Nome"><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
        <Field label="Email *"><Input type="email" value={edit?.email ?? ""} onChange={e => setEdit({ ...edit, email: e.target.value })}/></Field>
        <Field label="Telefone"><Input value={edit?.telefone ?? ""} onChange={e => setEdit({ ...edit, telefone: e.target.value })}/></Field>
        <Field label="Papel">
          <Select value={edit?.role ?? "vendedor"} onValueChange={v => setEdit({ ...edit, role: v as any })}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{ROLES.map(r => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
        <p className="text-xs text-muted-foreground">O email precisa pertencer a uma conta já cadastrada na plataforma.</p>
      </FormDialog>
    </>
  );
}
