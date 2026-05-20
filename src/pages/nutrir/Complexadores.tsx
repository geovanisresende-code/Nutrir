import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Edit, Save, FlaskRound } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtNum } from "@/lib/nutrir/format";

type Cmp = { id: string; nome: string; descricao: string | null; preco_litro: number; ativo: boolean };
type Fator = { id: string; complexador_id: string; nutriente_id: string; nivel: string; fator_l_kg_sal: number; observacao?: string | null };
type Nut = { id: string; simbolo: string; nome: string };

export default function Complexadores() {
  const [list, setList] = useState<Cmp[]>([]);
  const [fatores, setFatores] = useState<Fator[]>([]);
  const [nuts, setNuts] = useState<Nut[]>([]);
  const [edit, setEdit] = useState<Cmp | null>(null);
  const [open, setOpen] = useState(false);
  const [openFat, setOpenFat] = useState(false);
  const [selFat, setSelFat] = useState<Cmp | null>(null);
  const [novoFat, setNovoFat] = useState<Partial<Fator>>({ nivel: "padrao", fator_l_kg_sal: 0 });

  const load = async () => {
    const [{ data: c }, { data: f }, { data: n }] = await Promise.all([
      supabase.from("nutrir_complexadores").select("*").order("nome"),
      supabase.from("nutrir_complexador_fatores").select("*"),
      supabase.from("nutrir_nutrientes").select("id,simbolo,nome").order("ordem"),
    ]);
    setList((c as any) || []); setFatores((f as any) || []); setNuts((n as any) || []);
  };

  useEffect(() => { load(); }, []);

  // Catálogo completo Fertagro conforme planilha C.M.P
  const COMPLEXADORES_PADRAO = [
    { nome: "TSH",        descricao: "Complexante TSH — 15% sobre ureia em N180",        preco_litro: 18.0, ativo: true },
    { nome: "LEG",        descricao: "Complexante LEG — 6,25% sobre ureia / foliares",   preco_litro: 45.0, ativo: true },
    { nome: "Bor",        descricao: "Boro complexado líquido — 0,65 L por kg de ácido bórico", preco_litro: 32.0, ativo: true },
    { nome: "ÍON",        descricao: "Complexante ÍON — foliares",                        preco_litro: 75.0, ativo: true },
    { nome: "AMINO+",     descricao: "Aminoácidos — estímulo vegetal",                    preco_litro: 32.0, ativo: true },
    { nome: "ESTIMULL",   descricao: "Bioestimulante ESTIMULL",                           preco_litro: 90.0, ativo: true },
    { nome: "Life Grow",  descricao: "Complexante Life Grow — 18,75% sobre ureia em N180", preco_litro: 22.0, ativo: true },
    { nome: "Carbo Alga", descricao: "Extrato de algas — condicionador de solo",          preco_litro: 50.0, ativo: true },
  ];

  const nomesExistentes = new Set(list.map(c => c.nome.toLowerCase()));
  const complexadoresFaltando = COMPLEXADORES_PADRAO.filter(c => !nomesExistentes.has(c.nome.toLowerCase()));

  const seedPadrao = async () => {
    const { error } = await supabase.from("nutrir_complexadores").insert(COMPLEXADORES_PADRAO);
    if (error) toast.error("Erro ao popular: " + error.message);
    else { toast.success(`✅ ${COMPLEXADORES_PADRAO.length} complexadores inseridos!`); load(); }
  };

  const seedFaltando = async () => {
    const { error } = await supabase.from("nutrir_complexadores").insert(complexadoresFaltando);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success(`✅ ${complexadoresFaltando.length} complexadores adicionados!`); load(); }
  };

  const salvar = async () => {
    if (!edit?.nome) return toast.error("Nome obrigatório");
    const payload = { nome: edit.nome, descricao: edit.descricao, preco_litro: edit.preco_litro, ativo: edit.ativo };
    const { error } = edit.id
      ? await supabase.from("nutrir_complexadores").update(payload).eq("id", edit.id)
      : await supabase.from("nutrir_complexadores").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo ✓"); setOpen(false); load();
  };

  const remover = async (c: Cmp) => {
    if (!confirm(`Remover ${c.nome}?`)) return;
    await supabase.from("nutrir_complexador_fatores").delete().eq("complexador_id", c.id);
    await supabase.from("nutrir_complexadores").delete().eq("id", c.id);
    toast.success("Removido"); load();
  };

  const fatoresDe = (id: string) => fatores.filter((f) => f.complexador_id === id);

  const salvarFator = async () => {
    if (!selFat || !novoFat.nutriente_id) return toast.error("Selecione nutriente");
    const { error } = await supabase.from("nutrir_complexador_fatores").upsert({
      complexador_id: selFat.id,
      nutriente_id: novoFat.nutriente_id,
      nivel: novoFat.nivel || "padrao",
      fator_l_kg_sal: novoFat.fator_l_kg_sal || 0,
      observacao: novoFat.observacao || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Fator salvo ✓");
    setNovoFat({ nivel: "padrao", fator_l_kg_sal: 0 });
    load();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><FlaskRound /> Complexadores</h1>
          <p className="text-muted-foreground">Banco de complexadores (TSH, LEG, ÍON, BOR…) e fatores L/kg de sal</p>
        </div>
        <div className="flex gap-2">
          {list.length === 0 && (
            <Button variant="outline" onClick={seedPadrao}>
              ✨ Popular catálogo Fertagro ({COMPLEXADORES_PADRAO.length} itens)
            </Button>
          )}
          {list.length > 0 && complexadoresFaltando.length > 0 && (
            <Button variant="outline" onClick={seedFaltando}>
              ➕ Completar catálogo ({complexadoresFaltando.length} faltando)
            </Button>
          )}
          <Button onClick={() => { setEdit({ id: "", nome: "", descricao: "", preco_litro: 0, ativo: true }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Preço/L</TableHead>
                <TableHead>Fatores</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">{c.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.descricao}</TableCell>
                  <TableCell>{fmtBRL(c.preco_litro)}</TableCell>
                  <TableCell>{fatoresDe(c.id).length}</TableCell>
                  <TableCell>{c.ativo ? "✓" : "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setSelFat(c); setOpenFat(true); }}>Fatores</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remover(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Novo"} Complexador</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={edit.descricao || ""} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
              <div><Label>Preço por litro (R$)</Label><Input type="number" step="0.01" value={edit.preco_litro} onChange={(e) => setEdit({ ...edit, preco_litro: +e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openFat} onOpenChange={setOpenFat}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Fatores — {selFat?.nome}</DialogTitle></DialogHeader>
          {selFat && (
            <div className="space-y-4">
              <Card><CardContent className="p-4 grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Label>Nutriente</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-2" value={novoFat.nutriente_id || ""} onChange={(e) => setNovoFat({ ...novoFat, nutriente_id: e.target.value })}>
                    <option value="">Selecione…</option>
                    {nuts.map((n) => <option key={n.id} value={n.id}>{n.simbolo} — {n.nome}</option>)}
                  </select>
                </div>
                <div><Label>Nível</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-2" value={novoFat.nivel} onChange={(e) => setNovoFat({ ...novoFat, nivel: e.target.value })}>
                    <option value="padrao">Padrão</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option>
                  </select>
                </div>
                <div><Label>L / kg sal</Label><Input type="number" step="0.001" value={novoFat.fator_l_kg_sal} onChange={(e) => setNovoFat({ ...novoFat, fator_l_kg_sal: +e.target.value })} /></div>
                <div className="col-span-4"><Button onClick={salvarFator}><Plus className="h-4 w-4 mr-1" /> Adicionar/Atualizar fator</Button></div>
              </CardContent></Card>

              <Table>
                <TableHeader><TableRow><TableHead>Nutriente</TableHead><TableHead>Nível</TableHead><TableHead>L/kg sal</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {fatoresDe(selFat.id).map((f) => {
                    const n = nuts.find((x) => x.id === f.nutriente_id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell>{n?.simbolo} — {n?.nome}</TableCell>
                        <TableCell>{f.nivel}</TableCell>
                        <TableCell>{fmtNum(f.fator_l_kg_sal, 3)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("nutrir_complexador_fatores").delete().eq("id", f.id); load(); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
