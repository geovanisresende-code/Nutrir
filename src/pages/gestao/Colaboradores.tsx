import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudList } from "@/components/nutrir/CrudList";
import { FormDialog, Field } from "@/components/nutrir/FormDialog";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Colab {
  id: string; nome: string; razao_social: string | null; cpf_cnpj: string | null; registro_core: string | null;
  email: string | null; telefone: string | null; cargo: string; regional_id: string | null;
  ajuda_custo: number | null; adiantamento: number | null; comissao_base_pct: number | null;
  meta_mensal: number | null; bonus_meta_pct: number | null;
  veiculo_tipo: string | null; veiculo_modelo: string | null; veiculo_placa: string | null;
  veiculo_valor: number | null; veiculo_aluguel_mensal: number | null; ativo: boolean;
}

const CARGOS = [
  { v: "diretor", l: "Diretor" },
  { v: "gerente", l: "Gerente" },
  { v: "rtv", l: "RTV" },
  { v: "at", l: "Assistente Técnico" },
  { v: "consultor", l: "Consultor" },
];
const VEICULOS = [
  { v: "empresa", l: "Carro empresa" },
  { v: "locado", l: "Locado" },
  { v: "particular", l: "Particular" },
];

export default function Colaboradores() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<Colab>("nutrir_colaboradores", { orderBy: "nome" });
  const { data: regionais } = useOrgTable<{ id: string; nome: string }>("nutrir_regionais", { orderBy: "nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Colab> | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!current || !edit?.nome || !edit?.cargo) { toast({ title: "Nome e cargo obrigatórios", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      organization_id: current.id, nome: edit.nome, razao_social: edit.razao_social || null,
      cpf_cnpj: edit.cpf_cnpj || null, registro_core: edit.registro_core || null,
      email: edit.email || null, telefone: edit.telefone || null, cargo: edit.cargo,
      regional_id: edit.regional_id || null,
      ajuda_custo: edit.ajuda_custo ?? null, adiantamento: edit.adiantamento ?? null,
      comissao_base_pct: edit.comissao_base_pct ?? null, meta_mensal: edit.meta_mensal ?? null,
      bonus_meta_pct: edit.bonus_meta_pct ?? null,
      veiculo_tipo: edit.veiculo_tipo || null, veiculo_modelo: edit.veiculo_modelo || null,
      veiculo_placa: edit.veiculo_placa || null, veiculo_valor: edit.veiculo_valor ?? null,
      veiculo_aluguel_mensal: edit.veiculo_aluguel_mensal ?? null, ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await (supabase as any).from("nutrir_colaboradores").update(payload).eq("id", edit.id)
      : await (supabase as any).from("nutrir_colaboradores").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: edit.id ? "Atualizado" : "Cadastrado" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir colaborador?")) return;
    await (supabase as any).from("nutrir_colaboradores").delete().eq("id", id); reload();
  };

  return (
    <>
      <CrudList
        title="Representantes e Colaboradores"
        description="Hierarquia Diretor > Gerente > RTV > AT > Consultor"
        data={data} loading={loading} searchKeys={["nome","email","cpf_cnpj","registro_core"]}
        headers={["Nome","Cargo","Email","Telefone","Comissão","Meta","Ativo","Ações"]}
        onNew={() => { setEdit({ ativo: true, cargo: "rtv" }); setOpen(true); }}
        renderRow={(c) => (<>
          <td className="px-4 py-2 font-medium">{c.nome}</td>
          <td className="px-4 py-2"><Badge variant="outline">{CARGOS.find(x=>x.v===c.cargo)?.l ?? c.cargo}</Badge></td>
          <td className="px-4 py-2 text-xs">{c.email ?? "—"}</td>
          <td className="px-4 py-2 text-xs">{c.telefone ?? "—"}</td>
          <td className="px-4 py-2">{c.comissao_base_pct ? `${c.comissao_base_pct}%` : "—"}</td>
          <td className="px-4 py-2">{c.meta_mensal ? `R$ ${Number(c.meta_mensal).toLocaleString("pt-BR")}` : "—"}</td>
          <td className="px-4 py-2">{c.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
          <td className="px-4 py-2">
            <Button variant="ghost" size="icon" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="w-4 h-4"/></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
          </td>
        </>)}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={edit?.id ? "Editar colaborador" : "Novo colaborador"} onSave={onSave} saving={saving} maxW="max-w-3xl">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome *"><Input value={edit?.nome ?? ""} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></Field>
          <Field label="Razão social"><Input value={edit?.razao_social ?? ""} onChange={e => setEdit({ ...edit, razao_social: e.target.value })}/></Field>
          <Field label="CPF/CNPJ"><Input value={edit?.cpf_cnpj ?? ""} onChange={e => setEdit({ ...edit, cpf_cnpj: e.target.value })}/></Field>
          <Field label="Registro CORE"><Input value={edit?.registro_core ?? ""} onChange={e => setEdit({ ...edit, registro_core: e.target.value })}/></Field>
          <Field label="Email"><Input type="email" value={edit?.email ?? ""} onChange={e => setEdit({ ...edit, email: e.target.value })}/></Field>
          <Field label="Telefone"><Input value={edit?.telefone ?? ""} onChange={e => setEdit({ ...edit, telefone: e.target.value })}/></Field>
          <Field label="Cargo *">
            <Select value={edit?.cargo ?? "rtv"} onValueChange={v => setEdit({ ...edit, cargo: v })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{CARGOS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Regional">
            <Select value={edit?.regional_id ?? ""} onValueChange={v => setEdit({ ...edit, regional_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
              <SelectContent>{(regionais ?? []).map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <div className="border-t pt-3 mt-2">
          <h4 className="text-sm font-semibold mb-2">Financeiro</h4>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Ajuda de custo"><Input type="number" step="0.01" value={edit?.ajuda_custo ?? ""} onChange={e => setEdit({ ...edit, ajuda_custo: parseFloat(e.target.value) || null })}/></Field>
            <Field label="Adiantamento"><Input type="number" step="0.01" value={edit?.adiantamento ?? ""} onChange={e => setEdit({ ...edit, adiantamento: parseFloat(e.target.value) || null })}/></Field>
            <Field label="Comissão base (%)"><Input type="number" step="0.01" value={edit?.comissao_base_pct ?? ""} onChange={e => setEdit({ ...edit, comissao_base_pct: parseFloat(e.target.value) || null })}/></Field>
            <Field label="Meta mensal"><Input type="number" step="0.01" value={edit?.meta_mensal ?? ""} onChange={e => setEdit({ ...edit, meta_mensal: parseFloat(e.target.value) || null })}/></Field>
            <Field label="Bônus meta (%)"><Input type="number" step="0.01" value={edit?.bonus_meta_pct ?? ""} onChange={e => setEdit({ ...edit, bonus_meta_pct: parseFloat(e.target.value) || null })}/></Field>
          </div>
        </div>
        <div className="border-t pt-3 mt-2">
          <h4 className="text-sm font-semibold mb-2">Veículo</h4>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo">
              <Select value={edit?.veiculo_tipo ?? ""} onValueChange={v => setEdit({ ...edit, veiculo_tipo: v || null })}>
                <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                <SelectContent>{VEICULOS.map(v => <SelectItem key={v.v} value={v.v}>{v.l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Modelo"><Input value={edit?.veiculo_modelo ?? ""} onChange={e => setEdit({ ...edit, veiculo_modelo: e.target.value })}/></Field>
            <Field label="Placa"><Input value={edit?.veiculo_placa ?? ""} onChange={e => setEdit({ ...edit, veiculo_placa: e.target.value })}/></Field>
            <Field label="Valor (empresa)"><Input type="number" step="0.01" value={edit?.veiculo_valor ?? ""} onChange={e => setEdit({ ...edit, veiculo_valor: parseFloat(e.target.value) || null })}/></Field>
            <Field label="Aluguel mensal"><Input type="number" step="0.01" value={edit?.veiculo_aluguel_mensal ?? ""} onChange={e => setEdit({ ...edit, veiculo_aluguel_mensal: parseFloat(e.target.value) || null })}/></Field>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })}/><label className="text-sm">Ativo</label></div>
      </FormDialog>
    </>
  );
}
