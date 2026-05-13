import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit, Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { fmtNum } from "@/lib/nutrir/format";

type FCab = {
  id: string;
  formula_codigo: string;
  titulo: string;
  nivel: string;
  descricao: string | null;
  volume_batida_padrao_l: number;
  fator_diluicao: number;
  auto_ajuste_limite: boolean;
  status: string;
  ativa_calculadora: boolean;
};

type FRegra = {
  id: string;
  formula_codigo: string;
  nivel: string;
  ordem: number;
  materia_prima_nome: string;
  materia_prima_id: string | null;
  tipo_calculo: string;
  base_calculo: string | null;
  percentual: number;
  dose_valor: number | null;
  unidade: string;
  fator_diluicao: number;
  fator_complex_l_kg: number;
  complexante_nome: string | null;
  ativo: boolean;
};

export default function FontesFormulas() {
  const { current } = useOrg();
  const [tab, setTab] = useState("formulas");
  const [formulas, setFormulas] = useState<FCab[]>([]);
  const [regras, setRegras] = useState<FRegra[]>([]);
  const [selected, setSelected] = useState<FCab | null>(null);
  const [editForm, setEditForm] = useState<FCab | null>(null);
  const [editRegra, setEditRegra] = useState<FRegra | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openRegra, setOpenRegra] = useState(false);
  const [mps, setMps] = useState<{ id: string; nome: string }[]>([]);

  const loadAll = async () => {
    const [{ data: f }, { data: r }, { data: m }] = await Promise.all([
      supabase.from("nutrir_formula_cabecalho").select("*").order("formula_codigo"),
      supabase.from("nutrir_formula_regra").select("*").order("formula_codigo").order("ordem"),
      supabase.from("nutrir_materias_primas").select("id,nome").eq("organization_id", current?.id || "").order("nome"),
    ]);
    setFormulas((f as any) || []);
    setRegras((r as any) || []);
    setMps((m as any) || []);
  };

  useEffect(() => {
    if (current?.id) loadAll();
  }, [current?.id]);

  const regrasDaFormula = (cod: string) => regras.filter((r) => r.formula_codigo === cod);

  const novaFormula = () => {
    setEditForm({
      id: "",
      formula_codigo: "",
      titulo: "",
      nivel: "padrao",
      descricao: "",
      volume_batida_padrao_l: 1000,
      fator_diluicao: 1,
      auto_ajuste_limite: true,
      status: "rascunho",
      ativa_calculadora: true,
    });
    setOpenForm(true);
  };

  const salvarFormula = async () => {
    if (!editForm) return;
    if (!editForm.formula_codigo || !editForm.titulo) {
      toast.error("Código e título são obrigatórios");
      return;
    }
    const payload = {
      formula_codigo: editForm.formula_codigo,
      titulo: editForm.titulo,
      nivel: editForm.nivel,
      descricao: editForm.descricao,
      volume_batida_padrao_l: editForm.volume_batida_padrao_l,
      fator_diluicao: editForm.fator_diluicao,
      auto_ajuste_limite: editForm.auto_ajuste_limite,
      status: editForm.status,
      ativa_calculadora: editForm.ativa_calculadora,
    };
    const { error } = editForm.id
      ? await supabase.from("nutrir_formula_cabecalho").update(payload).eq("id", editForm.id)
      : await supabase.from("nutrir_formula_cabecalho").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Fórmula salva ✓");
    setOpenForm(false);
    loadAll();
  };

  const removerFormula = async (f: FCab) => {
    if (!confirm(`Remover fórmula ${f.formula_codigo}?`)) return;
    await supabase.from("nutrir_formula_regra").delete().eq("formula_codigo", f.formula_codigo);
    await supabase.from("nutrir_formula_cabecalho").delete().eq("id", f.id);
    toast.success("Removida");
    loadAll();
  };

  const duplicarFormula = async (f: FCab) => {
    const novoCod = `${f.formula_codigo}-COPIA`;
    const { error } = await supabase.from("nutrir_formula_cabecalho").insert({
      formula_codigo: novoCod,
      titulo: f.titulo + " (cópia)",
      nivel: f.nivel,
      descricao: f.descricao,
      volume_batida_padrao_l: f.volume_batida_padrao_l,
      fator_diluicao: f.fator_diluicao,
      auto_ajuste_limite: f.auto_ajuste_limite,
      status: "rascunho",
      ativa_calculadora: false,
    });
    if (error) return toast.error(error.message);
    const rs = regrasDaFormula(f.formula_codigo);
    if (rs.length) {
      await supabase.from("nutrir_formula_regra").insert(
        rs.map((r) => ({
          formula_codigo: novoCod,
          nivel: r.nivel,
          ordem: r.ordem,
          materia_prima_nome: r.materia_prima_nome,
          materia_prima_id: r.materia_prima_id,
          tipo_calculo: r.tipo_calculo,
          base_calculo: r.base_calculo,
          percentual: r.percentual,
          dose_valor: r.dose_valor,
          unidade: r.unidade,
          fator_diluicao: r.fator_diluicao,
          fator_complex_l_kg: r.fator_complex_l_kg,
          complexante_nome: r.complexante_nome,
          ativo: r.ativo,
        }))
      );
    }
    toast.success("Fórmula duplicada ✓");
    loadAll();
  };

  const novaRegra = (cod: string) => {
    setEditRegra({
      id: "",
      formula_codigo: cod,
      nivel: "padrao",
      ordem: regrasDaFormula(cod).length + 1,
      materia_prima_nome: "",
      materia_prima_id: null,
      tipo_calculo: "PCT_BASE",
      base_calculo: "BATIDA_KG",
      percentual: 0,
      dose_valor: null,
      unidade: "kg",
      fator_diluicao: 1,
      fator_complex_l_kg: 0,
      complexante_nome: null,
      ativo: true,
    });
    setOpenRegra(true);
  };

  const salvarRegra = async () => {
    if (!editRegra) return;
    const payload = { ...editRegra } as any;
    delete payload.id;
    const { error } = editRegra.id
      ? await supabase.from("nutrir_formula_regra").update(payload).eq("id", editRegra.id)
      : await supabase.from("nutrir_formula_regra").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Regra salva ✓");
    setOpenRegra(false);
    loadAll();
  };

  const removerRegra = async (r: FRegra) => {
    if (!confirm(`Remover regra ${r.materia_prima_nome}?`)) return;
    await supabase.from("nutrir_formula_regra").delete().eq("id", r.id);
    toast.success("Removida");
    loadAll();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fontes & Fórmulas</h1>
          <p className="text-muted-foreground">Banco editável de fórmulas, regras de cálculo e fontes nutritivas</p>
        </div>
        <Button onClick={novaFormula}>
          <Plus className="h-4 w-4 mr-2" /> Nova Fórmula
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="formulas">Fórmulas ({formulas.length})</TabsTrigger>
          <TabsTrigger value="regras">Regras ({regras.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="formulas" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Volume (L)</TableHead>
                    <TableHead>Diluição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Calculadora</TableHead>
                    <TableHead>Regras</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formulas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono font-bold">{f.formula_codigo}</TableCell>
                      <TableCell>{f.titulo}</TableCell>
                      <TableCell><Badge variant="outline">{f.nivel}</Badge></TableCell>
                      <TableCell>{fmtNum(f.volume_batida_padrao_l)}</TableCell>
                      <TableCell>{fmtNum(f.fator_diluicao, 2)}</TableCell>
                      <TableCell>
                        <Badge variant={f.status === "publicada" ? "default" : "secondary"}>{f.status}</Badge>
                      </TableCell>
                      <TableCell>{f.ativa_calculadora ? "✓" : "—"}</TableCell>
                      <TableCell>{regrasDaFormula(f.formula_codigo).length}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditForm(f); setOpenForm(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicarFormula(f)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setSelected(f); setTab("regras"); }}>
                          Regras
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removerFormula(f)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras" className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>Filtrar por fórmula:</Label>
            <Select value={selected?.formula_codigo || "_all"} onValueChange={(v) => setSelected(v === "_all" ? null : formulas.find((f) => f.formula_codigo === v) || null)}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {formulas.map((f) => (
                  <SelectItem key={f.id} value={f.formula_codigo}>{f.formula_codigo} — {f.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <Button size="sm" onClick={() => novaRegra(selected.formula_codigo)}>
                <Plus className="h-4 w-4 mr-1" /> Nova regra
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fórmula</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Matéria-prima</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Dose</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selected ? regrasDaFormula(selected.formula_codigo) : regras).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.formula_codigo}</TableCell>
                      <TableCell>{r.ordem}</TableCell>
                      <TableCell>{r.materia_prima_nome}</TableCell>
                      <TableCell><Badge variant="outline">{r.tipo_calculo}</Badge></TableCell>
                      <TableCell className="text-xs">{r.base_calculo}</TableCell>
                      <TableCell>{r.percentual ? fmtNum(r.percentual, 2) + "%" : "—"}</TableCell>
                      <TableCell>{r.dose_valor != null ? fmtNum(r.dose_valor, 2) : "—"}</TableCell>
                      <TableCell>{r.unidade}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditRegra(r); setOpenRegra(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removerRegra(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG FORMULA */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editForm?.id ? "Editar" : "Nova"} Fórmula</DialogTitle></DialogHeader>
          {editForm && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input value={editForm.formula_codigo} onChange={(e) => setEditForm({ ...editForm, formula_codigo: e.target.value.toUpperCase() })} placeholder="N180" />
              </div>
              <div>
                <Label>Nível</Label>
                <Select value={editForm.nivel} onValueChange={(v) => setEditForm({ ...editForm, nivel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="especial">Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input value={editForm.titulo} onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Input value={editForm.descricao || ""} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} />
              </div>
              <div>
                <Label>Volume batida (L)</Label>
                <Input type="number" value={editForm.volume_batida_padrao_l} onChange={(e) => setEditForm({ ...editForm, volume_batida_padrao_l: +e.target.value })} />
              </div>
              <div>
                <Label>Fator diluição</Label>
                <Input type="number" step="0.01" value={editForm.fator_diluicao} onChange={(e) => setEditForm({ ...editForm, fator_diluicao: +e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="publicada">Publicada</SelectItem>
                    <SelectItem value="arquivada">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <input type="checkbox" id="ativa" checked={editForm.ativa_calculadora} onChange={(e) => setEditForm({ ...editForm, ativa_calculadora: e.target.checked })} />
                <Label htmlFor="ativa">Disponível na calculadora</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button onClick={salvarFormula}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG REGRA */}
      <Dialog open={openRegra} onOpenChange={setOpenRegra}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editRegra?.id ? "Editar" : "Nova"} Regra de cálculo</DialogTitle></DialogHeader>
          {editRegra && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fórmula</Label>
                <Input value={editRegra.formula_codigo} disabled />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={editRegra.ordem} onChange={(e) => setEditRegra({ ...editRegra, ordem: +e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Matéria-prima</Label>
                <Select value={editRegra.materia_prima_id || "_manual"} onValueChange={(v) => {
                  if (v === "_manual") setEditRegra({ ...editRegra, materia_prima_id: null });
                  else { const mp = mps.find((x) => x.id === v); setEditRegra({ ...editRegra, materia_prima_id: v, materia_prima_nome: mp?.nome || "" }); }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_manual">Manual (digitar nome)</SelectItem>
                    {mps.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Nome (matéria-prima)</Label>
                <Input value={editRegra.materia_prima_nome} onChange={(e) => setEditRegra({ ...editRegra, materia_prima_nome: e.target.value })} />
              </div>
              <div>
                <Label>Tipo de cálculo</Label>
                <Select value={editRegra.tipo_calculo} onValueChange={(v) => setEditRegra({ ...editRegra, tipo_calculo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCT_BASE">% sobre base</SelectItem>
                    <SelectItem value="DOSE_FIXA">Dose fixa</SelectItem>
                    <SelectItem value="COMPLEXADOR">Complexador (L/kg sal)</SelectItem>
                    <SelectItem value="DILUENTE">Diluente (água)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Base de cálculo</Label>
                <Select value={editRegra.base_calculo || "BATIDA_KG"} onValueChange={(v) => setEditRegra({ ...editRegra, base_calculo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BATIDA_KG">Total da batida (kg)</SelectItem>
                    <SelectItem value="VOLUME_L">Volume final (L)</SelectItem>
                    <SelectItem value="SAIS_KG">Soma sais (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Percentual (%)</Label>
                <Input type="number" step="0.01" value={editRegra.percentual} onChange={(e) => setEditRegra({ ...editRegra, percentual: +e.target.value })} />
              </div>
              <div>
                <Label>Dose</Label>
                <Input type="number" step="0.01" value={editRegra.dose_valor ?? ""} onChange={(e) => setEditRegra({ ...editRegra, dose_valor: e.target.value === "" ? null : +e.target.value })} />
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={editRegra.unidade} onValueChange={(v) => setEditRegra({ ...editRegra, unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="mL">mL</SelectItem>
                    <SelectItem value="%">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fator complexador (L/kg sal)</Label>
                <Input type="number" step="0.001" value={editRegra.fator_complex_l_kg} onChange={(e) => setEditRegra({ ...editRegra, fator_complex_l_kg: +e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRegra(false)}>Cancelar</Button>
            <Button onClick={salvarRegra}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
