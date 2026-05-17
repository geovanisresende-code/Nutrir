import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Send, FileText, ScanLine, ShieldAlert, AlertCircle, Download, Users, MapPin } from "lucide-react";
import VendedorBadge from "@/components/representante/VendedorBadge";
import DocumentScanner from "@/components/representante/DocumentScanner";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { usePosition } from "@/hooks/usePosition";
import * as XLSX from "xlsx";

const CATEGORIAS = [
  { v: "combustivel",       l: "Combustível" },
  { v: "alimentacao",       l: "Alimentação" },
  { v: "hospedagem",        l: "Hospedagem" },
  { v: "pedagio",           l: "Pedágio" },
  { v: "manutencao",        l: "Manutenção do veículo" },
  { v: "lavagem",           l: "Lavagem do veículo" },
  { v: "estacionamento",    l: "Estacionamento" },
  { v: "entretenimento",    l: "Entretenimento" },
  { v: "outros",            l: "Outros" },
] as const;

// Categorias que precisam de aprovação superior
const CATEGORIAS_APROVACAO = ["entretenimento"];

const SUBCATEGORIAS: Record<string, { v: string; l: string }[]> = {
  alimentacao: [
    { v: "cafe_manha",   l: "☕ Café da manhã" },
    { v: "almoco",       l: "🍽️ Almoço" },
    { v: "lanche_tarde", l: "🥪 Lanche da tarde" },
    { v: "jantar",       l: "🌙 Jantar" },
    { v: "outros",       l: "Outros" },
  ],
  entretenimento: [
    { v: "cliente",      l: "Entretenimento com cliente" },
    { v: "equipe",       l: "Confraternização de equipe" },
    { v: "evento",       l: "Evento / Feira" },
    { v: "outros",       l: "Outros" },
  ],
};

const COMBUSTIVEIS = [
  { v: "gasolina", l: "Gasolina" },
  { v: "alcool", l: "Álcool" },
  { v: "diesel", l: "Diesel" },
] as const;

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "secondary", enviado: "outline", aprovado: "default", rejeitado: "destructive", pago: "default",
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => {
  // Aceita "1.234,56" (br) ou "1234.56" — sempre retorna number
  if (!s) return 0;
  const cleaned = s.toString().replace(/[^\d,.-]/g, "");
  // se tem vírgula, é decimal br — remove pontos (milhar) e troca vírgula por ponto
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  return Number(normalized) || 0;
};

// Formata um valor numérico no padrão br: "1.234,56"
const fmtBR = (n: number, decimals = 2) =>
  isFinite(n)
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : "";

// Input com prefixo/sufixo fixo (R$, L, ha) — formatação BR ao perder foco.
// Durante digitação aceita texto livre; ao sair completa "1.234,56".
function Affixed({
  prefix, suffix, value, onChange, disabled, required, readOnly, decimals = 2,
}: {
  prefix?: string; suffix?: string;
  value: string; onChange?: (v: string) => void;
  disabled?: boolean; required?: boolean; readOnly?: boolean;
  decimals?: number;
}) {
  const [focused, setFocused] = React.useState(false);

  // Display: formatado quando sem foco, raw quando focado
  const display = focused
    ? value
    : (value ? fmtBR(num(value), decimals) : "");

  return (
    <div className={`flex items-stretch rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring ${disabled || readOnly ? "opacity-70" : ""}`}>
      {prefix && <span className="px-2.5 flex items-center text-sm text-muted-foreground bg-muted/40 border-r border-input select-none">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        className="flex-1 px-3 py-2 text-sm bg-transparent outline-none disabled:cursor-not-allowed"
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          // Ao sair, normaliza o valor armazenado pro número limpo
          if (onChange && value) {
            const n = num(value);
            onChange(n === 0 ? "" : String(n));
          }
        }}
        onChange={(e) => {
          if (readOnly || !onChange) return;
          let v = e.target.value.replace(/[^\d.,]/g, "");
          v = v.replace(/^0+(?=\d)/, "");
          onChange(v);
        }}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        placeholder=""
      />
      {suffix && <span className="px-2.5 flex items-center text-sm text-muted-foreground bg-muted/40 border-l border-input select-none">{suffix}</span>}
    </div>
  );
}

export default function RDV() {
  const { current } = useOrg();
  const { user } = useAuth();
  const { position } = usePosition();
  const isAdmin = position === "diretor" || position === "proprietario" || position === "gerente";
  const [items, setItems] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [limiteMensal, setLimiteMensal] = useState<number | null>(null);
  const [antifraude, setAntifraude] = useState<{ id: string; alerta: string } | null>(null);

  // form
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState<string>("combustivel");
  const [subcategoria, setSubcategoria] = useState<string>("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  // combustível
  const [combTipo, setCombTipo] = useState<string>("gasolina");
  const [litros, setLitros] = useState("");
  const [precoLitro, setPrecoLitro] = useState("");
  const [kmIni, setKmIni] = useState("");
  const [kmFim, setKmFim] = useState("");
  const [primeiroAbastecimento, setPrimeiroAbastecimento] = useState(false);
  // hospedagem
  const [hotelNome, setHotelNome] = useState("");
  const [cupom, setCupom] = useState<File | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // CNPJ anti-fraude
  const [cnpjNf, setCnpjNf] = useState("");
  const [cnpjInfo, setCnpjInfo] = useState<{ nome: string; situacao: string } | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjAlerta, setCnpjAlerta] = useState<string | null>(null);

  const load = async () => {
    if (!current || !user) return;
    const { data: rows } = await supabase
      .from("nutrir_rdv" as any)
      .select("*")
      .eq("organization_id", current.id)
      .order("data", { ascending: false })
      .limit(500);
    setItems((rows as any[]) ?? []);

    // Representantes da organização (para auditoria)
    const { data: repRows } = await supabase
      .from("nutrir_representantes" as any)
      .select("id, nome, regional, user_id")
      .eq("organization_id", current.id);
    setReps((repRows as any[]) ?? []);

    // Tenta carregar limite mensal do perfil do usuário
    const { data: perfil } = await supabase
      .from("profiles")
      .select("rdv_limite_mensal")
      .eq("id", user.id)
      .maybeSingle();
    if ((perfil as any)?.rdv_limite_mensal) {
      setLimiteMensal(Number((perfil as any).rdv_limite_mensal));
    }
  };
  useEffect(() => { load(); }, [current?.id, user?.id]);

  // último km final do usuário (combustível) — para autopreencher km inicial
  const ultimoKmFinal = useMemo(() => {
    const meus = items
      .filter((i) => i.user_id === user?.id && i.categoria === "combustivel" && i.km_final != null)
      .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return meus[0]?.km_final ?? null;
  }, [items, user]);

  const temAbastecimentoAnterior = ultimoKmFinal != null;

  // ao abrir / mudar categoria, autopreencher km inicial
  useEffect(() => {
    if (categoria === "combustivel" && temAbastecimentoAnterior && !primeiroAbastecimento) {
      setKmIni(String(ultimoKmFinal));
    }
  }, [categoria, temAbastecimentoAnterior, ultimoKmFinal, primeiroAbastecimento]);

  // valor automático = litros * preço/litro (combustível) — fixo e inalterável
  useEffect(() => {
    if (categoria === "combustivel") {
      const v = num(litros) * num(precoLitro);
      setValor(v > 0 ? v.toFixed(2).replace(".", ",") : "");
    }
  }, [litros, precoLitro, categoria]);

  const reset = () => {
    setData(new Date().toISOString().slice(0, 10));
    setCategoria("combustivel"); setSubcategoria(""); setValor(""); setDescricao("");
    setCidade(""); setUf("");
    setCombTipo("gasolina"); setLitros(""); setPrecoLitro("");
    setKmIni(""); setKmFim(""); setPrimeiroAbastecimento(false);
    setHotelNome(""); setCupom(null);
    setCnpjNf(""); setCnpjInfo(null); setCnpjAlerta(null);
  };

  const validarCNPJ = async (cnpj: string) => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    setCnpjInfo(null); setCnpjAlerta(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const json = await res.json();
      const situacao = json.descricao_situacao_cadastral ?? json.situacao_cadastral ?? "";
      const nome = json.razao_social ?? json.nome ?? "—";
      setCnpjInfo({ nome, situacao });
      if (situacao && situacao.toLowerCase() !== "ativa") {
        setCnpjAlerta(`⚠️ CNPJ com situação "${situacao}" — verifique a autenticidade da nota.`);
      }
    } catch {
      setCnpjAlerta("CNPJ não encontrado na Receita Federal — possível fraude.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user) return;
    setLoading(true);
    let cupomPath: string | null = null;
    try {
      if (cupom) {
        const ext = cupom.name.split(".").pop() ?? "jpg";
        cupomPath = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("rdv-cupons").upload(cupomPath, cupom, { upsert: false });
        if (upErr) throw upErr;
      }
      const payload: any = {
        organization_id: current.id,
        user_id: user.id,
        data,
        categoria,
        subcategoria: subcategoria || null,
        descricao: descricao || null,
        valor: num(valor),
        cidade: cidade || null,
        uf: uf || null,
        cupom_path: cupomPath,
        status: "rascunho",
      };
      if (categoria === "combustivel") {
        payload.combustivel_tipo = combTipo;
        payload.litros = num(litros);
        payload.preco_litro = num(precoLitro);
        payload.km_inicial = kmIni ? Number(kmIni) : null;
        payload.km_final = kmFim ? Number(kmFim) : null;
      }
      if (categoria === "hospedagem") {
        payload.hotel_nome = hotelNome || null;
      }
      const { data: insertedRow, error } = await supabase.from("nutrir_rdv" as any).insert(payload).select().single();
      if (error) throw error;
      toast.success("Despesa lançada");
      setOpen(false); reset(); load();

      // IA antifraude (assíncrono — não bloqueia o fluxo)
      if (insertedRow) {
        supabase.functions.invoke("rdv-antifraude", {
          body: {
            rdv_id: (insertedRow as any).id,
            valor: num(valor),
            categoria,
            subcategoria: subcategoria || null,
            descricao: descricao || null,
          },
        }).then(({ data: res }) => {
          if (res?.alerta) {
            setAntifraude({ id: (insertedRow as any).id, alerta: res.alerta });
            toast.warning("⚠️ IA detectou possível anomalia — verifique a despesa.");
          }
        }).catch(() => { /* silencioso */ });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const enviar = async (id: string) => {
    const { error } = await supabase.from("nutrir_rdv" as any).update({ status: "enviado" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Enviado para aprovação");
    load();
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir lançamento?")) return;
    const { error } = await supabase.from("nutrir_rdv" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const verCupom = async (path: string) => {
    const { data, error } = await supabase.storage.from("rdv-cupons").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const meus = useMemo(() => items.filter((i) => i.user_id === user?.id), [items, user]);
  const total = useMemo(() => meus.reduce((a, i) => a + Number(i.valor || 0), 0), [meus]);
  const totalMes = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return meus.filter((i) => (i.data ?? "").startsWith(ym)).reduce((a, i) => a + Number(i.valor || 0), 0);
  }, [meus]);

  // Histórico mensal — últimos 6 meses
  const historicoMensal = useMemo(() => {
    const result: { mes: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const total = meus.filter(r => (r.data ?? "").startsWith(ym)).reduce((a, r) => a + Number(r.valor || 0), 0);
      result.push({ mes: label, total });
    }
    return result;
  }, [meus]);

  // Export CSV histórico simples
  const exportarCSV = () => {
    const header = "Data,Categoria,Subcategoria,Cidade,UF,Valor,Status,Descrição\n";
    const body = items.map(i =>
      [i.data, i.categoria, i.subcategoria ?? "", i.cidade ?? "", i.uf ?? "", i.valor, i.status, (i.descricao ?? "").replace(/,/g, ";")].join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "rdv-historico.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV contábil (BOM UTF-8, separador ";", inclui CNPJ e hotel)
  const exportarContabil = () => {
    const cols = ["Data","Categoria","Subcategoria","Cidade","UF","Valor","Status","CNPJ Fornecedor","Hotel","Descrição"];
    const rows = items.map(i => [
      i.data ?? "",
      i.categoria ?? "",
      i.subcategoria ?? "",
      i.cidade ?? "",
      i.uf ?? "",
      Number(i.valor || 0).toFixed(2).replace(".",","),
      i.status ?? "",
      i.cnpj_fornecedor ?? "",
      i.hotel_nome ?? "",
      (i.descricao ?? "").replace(/;/g,","),
    ].join(";"));
    const csv = "﻿" + [cols.join(";"), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "rdv-contabil.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Export Excel contábil (.xlsx)
  const exportarExcel = () => {
    const repMap = Object.fromEntries(reps.map((r) => [r.user_id, { nome: r.nome, regional: r.regional }]));
    const rows = items.map((i) => {
      const rep = repMap[i.user_id] ?? {};
      return {
        "Data": i.data ?? "",
        "Consultor": rep.nome ?? i.user_id ?? "",
        "Regional": rep.regional ?? "",
        "Categoria": i.categoria ?? "",
        "Subcategoria": i.subcategoria ?? "",
        "Cidade": i.cidade ?? "",
        "UF": i.uf ?? "",
        "Valor (R$)": Number(i.valor || 0),
        "Status": i.status ?? "",
        "CNPJ Fornecedor": i.cnpj_fornecedor ?? "",
        "Hotel": i.hotel_nome ?? "",
        "Combustível": i.combustivel_tipo ?? "",
        "Litros": i.litros ?? "",
        "KM Inicial": i.km_inicial ?? "",
        "KM Final": i.km_final ?? "",
        "Descrição": i.descricao ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    // Formata coluna Valor como número
    const wscols = [
      { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 16 }, { wch: 16 },
      { wch: 15 }, { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 20 },
      { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 30 },
    ];
    ws["!cols"] = wscols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RDV");

    // Aba resumo por consultor
    const porConsultor: Record<string, number> = {};
    items.forEach((i) => {
      const nome = repMap[i.user_id]?.nome ?? (i.user_id ?? "Desconhecido");
      porConsultor[nome] = (porConsultor[nome] ?? 0) + Number(i.valor || 0);
    });
    const wsConsultor = XLSX.utils.json_to_sheet(
      Object.entries(porConsultor).map(([Consultor, Total]) => ({ Consultor, "Total (R$)": Total }))
    );
    XLSX.utils.book_append_sheet(wb, wsConsultor, "Por Consultor");

    // Aba resumo por regional
    const porRegional: Record<string, number> = {};
    items.forEach((i) => {
      const reg = repMap[i.user_id]?.regional ?? "Sem Regional";
      porRegional[reg] = (porRegional[reg] ?? 0) + Number(i.valor || 0);
    });
    const wsRegional = XLSX.utils.json_to_sheet(
      Object.entries(porRegional).map(([Regional, Total]) => ({ Regional, "Total (R$)": Total }))
    );
    XLSX.utils.book_append_sheet(wb, wsRegional, "Por Regional");

    XLSX.writeFile(wb, "rdv-contabil.xlsx");
    toast.success("Excel exportado!");
  };

  // OCR: leitura de cupom por IA
  const lerCupomIA = async (file: File) => {
    setCupom(file);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const { data: res } = await supabase.functions.invoke("ia-leitura-nf", {
          body: { imagem_base64: base64, tipo: "cupom_rdv" },
        });
        if (!res) return;
        if (res.valor)     setValor(String(res.valor));
        if (res.categoria) setCategoria(res.categoria);
        if (res.data)      setData(res.data);
        if (res.cnpj)      { setCnpjNf(res.cnpj); validarCNPJ(res.cnpj); }
        toast.success("✓ Cupom lido pela IA — confira e ajuste se necessário.");
      };
    } catch { /* preencher manualmente */ }
  };

  return (
    <>
      <PageHeader
        title="RDV — Despesas de Viagem"
        description="Combustível, alimentação, hospedagem e mais"
        actions={
          <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              const fim = new Date();
              const inicio = new Date(fim.getFullYear(), fim.getMonth(), 1);
              const doMes = items.filter(i => {
                if (!i.data) return false;
                const d = new Date(i.data);
                return d >= inicio && d <= fim;
              });
              if (doMes.length === 0) {
                toast({ title: "Sem lançamentos no mês atual" });
                return;
              }
              const { gerarRdvPDF, baixarBlobRDV } = await import("@/lib/nutrir/rdv-pdf");
              const blob = await gerarRdvPDF({
                rdvs: doMes,
                vendedor: { nome: user?.email ?? "Vendedor" },
                periodo: { inicio, fim },
              });
              const mes = `${inicio.getFullYear()}-${String(inicio.getMonth()+1).padStart(2,"0")}`;
              baixarBlobRDV(blob, `rdv-${mes}.pdf`);
              toast({ title: "PDF baixado!" });
            } catch (e: any) {
              toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
            }
          }}>
            <FileText className="h-4 w-4 mr-1" /> Baixar PDF do mês
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" /> Nova despesa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Lançar despesa</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Select value={categoria} onValueChange={(v) => { setCategoria(v); setSubcategoria(""); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Subcategoria (alimentação / entretenimento) */}
                {SUBCATEGORIAS[categoria] && (
                  <div className="space-y-1.5">
                    <Label>Subcategoria</Label>
                    <Select value={subcategoria} onValueChange={setSubcategoria}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {SUBCATEGORIAS[categoria].map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Alerta categorias que precisam de aprovação */}
                {CATEGORIAS_APROVACAO.includes(categoria) && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span><strong>Atenção:</strong> Despesas de entretenimento requerem aprovação do superior. O lançamento ficará pendente até ser aprovado.</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Cidade</Label>
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Cuiabá" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Select value={uf} onValueChange={setUf}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {categoria === "combustivel" && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Combustível</Label>
                        <Select value={combTipo} onValueChange={setCombTipo}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COMBUSTIVEIS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5"><Label>Litros</Label><Affixed suffix="L" value={litros} onChange={setLitros} required /></div>
                      <div className="space-y-1.5"><Label>Preço/Litro</Label><Affixed prefix="R$" value={precoLitro} onChange={setPrecoLitro} required /></div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor do abastecimento</Label>
                      <Affixed prefix="R$" value={valor} readOnly required />
                      <p className="text-[11px] text-muted-foreground">Calculado automaticamente (litros × preço) — não editável.</p>
                    </div>
                    {!temAbastecimentoAnterior && (
                      <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        Primeiro abastecimento — informe KM inicial e final.
                      </div>
                    )}
                    {temAbastecimentoAnterior && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={primeiroAbastecimento}
                          onChange={(e) => { setPrimeiroAbastecimento(e.target.checked); if (e.target.checked) setKmIni(""); else setKmIni(String(ultimoKmFinal)); }}
                        />
                        Editar KM inicial manualmente (caso de troca de veículo)
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>KM inicial</Label>
                        <Affixed
                          suffix="km"
                          value={kmIni}
                          onChange={setKmIni}
                          disabled={temAbastecimentoAnterior && !primeiroAbastecimento}
                          required
                        />
                      </div>
                      <div className="space-y-1.5"><Label>KM final</Label><Affixed suffix="km" value={kmFim} onChange={setKmFim} required /></div>
                    </div>
                  </>
                )}

                {categoria === "hospedagem" && (
                  <div className="space-y-1.5">
                    <Label>Nome do hotel</Label>
                    <Input value={hotelNome} onChange={(e) => setHotelNome(e.target.value)} placeholder="Ex.: Hotel Bristol" required />
                  </div>
                )}

                {categoria !== "combustivel" && (
                  <div className="space-y-1.5"><Label>Valor</Label><Affixed prefix="R$" value={valor} onChange={setValor} required /></div>
                )}

                <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Observações…" /></div>

                <div className="space-y-2 border rounded-lg p-3">
                  <Label className="flex items-center gap-1.5"><ScanLine className="h-4 w-4" /> Cupom / nota fiscal</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Ler por IA */}
                    <Button
                      type="button" variant="outline"
                      className="flex-1 min-w-[150px] border-purple-300 text-purple-700 hover:bg-purple-50"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file"; input.accept = "image/*,application/pdf";
                        input.onchange = (ev) => {
                          const f = (ev.target as HTMLInputElement).files?.[0];
                          if (f) lerCupomIA(f);
                        };
                        input.click();
                      }}
                    >
                      <ScanLine className="h-4 w-4 mr-1.5 text-purple-600" />
                      Ler por IA
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setScannerOpen(true)} className="flex-1 min-w-[150px]">
                      <ScanLine className="h-4 w-4 mr-1.5" />
                      {cupom ? "Reescanear NF" : "Escanear NF / Cupom"}
                    </Button>
                    {cupom && (
                      <>
                        <Badge variant="secondary" className="text-[10px]">
                          {cupom.name.length > 20 ? cupom.name.slice(0, 20) + "…" : cupom.name}
                        </Badge>
                        <Button type="button" size="icon" variant="ghost" onClick={() => setCupom(null)}>
                          <Trash2 className="h-3.5 h-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O scanner corrige contraste/brilho da foto automaticamente. Disponível "P&B alto contraste" pra notas térmicas apagadas.
                  </p>
                  <DocumentScanner
                    open={scannerOpen}
                    onOpenChange={setScannerOpen}
                    onCapture={(f) => setCupom(f)}
                  />

                  {/* CNPJ da nota — anti-fraude */}
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> CNPJ do estabelecimento (anti-fraude)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={cnpjNf}
                        onChange={(e) => {
                          // Formata XX.XXX.XXX/XXXX-XX
                          let v = e.target.value.replace(/\D/g, "").slice(0, 14);
                          if (v.length > 12) v = v.slice(0,2)+"."+v.slice(2,5)+"."+v.slice(5,8)+"/"+v.slice(8,12)+"-"+v.slice(12);
                          else if (v.length > 8) v = v.slice(0,2)+"."+v.slice(2,5)+"."+v.slice(5,8)+"/"+v.slice(8);
                          else if (v.length > 5) v = v.slice(0,2)+"."+v.slice(2,5)+"."+v.slice(5);
                          else if (v.length > 2) v = v.slice(0,2)+"."+v.slice(2);
                          setCnpjNf(v);
                          setCnpjInfo(null); setCnpjAlerta(null);
                        }}
                        placeholder="00.000.000/0000-00"
                        className="font-mono h-8 text-xs flex-1"
                        maxLength={18}
                      />
                      <Button type="button" size="sm" variant="outline"
                        disabled={cnpjNf.replace(/\D/g,"").length !== 14 || cnpjLoading}
                        onClick={() => validarCNPJ(cnpjNf)}>
                        {cnpjLoading ? "…" : "Validar"}
                      </Button>
                    </div>
                    {cnpjInfo && !cnpjAlerta && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                        ✓ {cnpjInfo.nome} — Situação: {cnpjInfo.situacao}
                      </div>
                    )}
                    {cnpjAlerta && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                        {cnpjAlerta}
                        {cnpjInfo && <div className="mt-0.5 opacity-70">{cnpjInfo.nome}</div>}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading} className="bg-gradient-primary">
                    {loading ? "Salvando…" : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <VendedorBadge />

        {/* Alerta antifraude IA */}
        {antifraude && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-800">IA Antifraude detectou anomalia</div>
              <div className="text-xs text-amber-700 mt-0.5">{antifraude.alerta}</div>
            </div>
            <button onClick={() => setAntifraude(null)} className="ml-auto text-amber-500 hover:text-amber-700 text-xs">✕</button>
          </div>
        )}

        {/* Limites por categoria */}
        {(() => {
          const ym = new Date().toISOString().slice(0, 7);
          const LIMITES_CAT: Record<string, number> = {
            combustivel: 800, alimentacao: 400, hospedagem: 600,
            pedagio: 150, manutencao: 300, lavagem: 80,
            estacionamento: 60, entretenimento: 200, outros: 100,
          };
          const gastosDoMes = CATEGORIAS.map(({ v, l }) => {
            const gasto = meus.filter(i => (i.data ?? "").startsWith(ym) && i.categoria === v)
              .reduce((a, i) => a + Number(i.valor || 0), 0);
            const limite = LIMITES_CAT[v] ?? 0;
            const pct = limite > 0 ? Math.min(100, (gasto / limite) * 100) : 0;
            return { v, l, gasto, limite, pct };
          }).filter(c => c.gasto > 0 || c.limite > 0);

          if (gastosDoMes.length === 0) return null;
          return (
            <Card><CardContent className="p-4">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" /> Gastos por categoria — mês atual
              </div>
              <div className="space-y-2">
                {gastosDoMes.map(({ v, l, gasto, limite, pct }) => (
                  <div key={v} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{l}</span>
                      <span className={`font-mono ${pct >= 100 ? "text-red-600 font-bold" : pct >= 80 ? "text-amber-600" : ""}`}>
                        {fmt(gasto)} {limite > 0 ? `/ ${fmt(limite)}` : ""}
                      </span>
                    </div>
                    {limite > 0 && (
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent></Card>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total no mês</div>
              <div className="text-2xl font-bold">{fmt(totalMes)}</div>
              {limiteMensal != null && (
                <>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${totalMes / limiteMensal > 0.9 ? "bg-red-500" : totalMes / limiteMensal > 0.7 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, (totalMes / limiteMensal) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Limite: {fmt(limiteMensal)} · Disponível: {fmt(Math.max(0, limiteMensal - totalMes))}
                  </div>
                  {totalMes > limiteMensal && (
                    <div className="flex items-center gap-1 text-[11px] text-red-600 font-medium mt-0.5">
                      <AlertCircle className="h-3 w-3" /> Limite excedido em {fmt(totalMes - limiteMensal)}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total lançado</div><div className="text-2xl font-bold">{fmt(total)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Lançamentos</div><div className="text-2xl font-bold">{meus.length}</div></CardContent></Card>
        </div>

        {/* Gráfico mensal */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Despesas — últimos 6 meses</h3>
            <Button size="sm" variant="outline" onClick={exportarCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportarContabil} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <Download className="h-3.5 w-3.5 mr-1" /> CSV contábil
            </Button>
            <Button size="sm" variant="outline" onClick={exportarExcel} className="border-blue-300 text-blue-700 hover:bg-blue-50">
              <Download className="h-3.5 w-3.5 mr-1" /> Excel
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={historicoMensal}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Tabs defaultValue="meus">
          <TabsList>
            <TabsTrigger value="meus">Meus lançamentos</TabsTrigger>
            {isAdmin && <TabsTrigger value="auditoria"><Users className="h-3.5 w-3.5 mr-1" />Auditoria geral</TabsTrigger>}
          </TabsList>

          {/* ── Meus lançamentos ── */}
          <TabsContent value="meus">
            <Card><CardContent className="p-0">
              {meus.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Nenhuma despesa lançada ainda.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data</TableHead><TableHead>Categoria</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {meus.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-xs">{i.data}</TableCell>
                        <TableCell className="capitalize">
                          {i.categoria}
                          {i.categoria === "combustivel" && i.combustivel_tipo && (
                            <span className="text-xs text-muted-foreground ml-1">({i.combustivel_tipo})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{[i.cidade, i.uf].filter(Boolean).join("/") || "—"}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {i.categoria === "hospedagem" && i.hotel_nome ? i.hotel_nome : (i.descricao ?? "—")}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(i.valor))}</TableCell>
                        <TableCell><Badge variant={STATUS_COLORS[i.status]}>{i.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {i.cupom_path && (
                              <Button size="icon" variant="ghost" onClick={() => verCupom(i.cupom_path)} title="Ver cupom">
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                            {i.user_id === user?.id && i.status === "rascunho" && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => enviar(i.id)} title="Enviar">
                                  <Send className="h-4 w-4 text-primary" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => remover(i.id)} title="Excluir">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* ── Auditoria geral (admin) ── */}
          {isAdmin && (
            <TabsContent value="auditoria" className="space-y-4">
              {(() => {
                const ym = new Date().toISOString().slice(0, 7);
                const repMap = Object.fromEntries(reps.map((r) => [r.user_id, { nome: r.nome, regional: r.regional }]));

                // Gastos por consultor (mês atual)
                const porConsultor: Record<string, { nome: string; regional: string; total: number; count: number }> = {};
                items.filter(i => (i.data ?? "").startsWith(ym)).forEach((i) => {
                  const uid = i.user_id ?? "desconhecido";
                  const info = repMap[uid] ?? { nome: uid.slice(0, 8) + "…", regional: "—" };
                  if (!porConsultor[uid]) porConsultor[uid] = { nome: info.nome, regional: info.regional ?? "—", total: 0, count: 0 };
                  porConsultor[uid].total += Number(i.valor || 0);
                  porConsultor[uid].count += 1;
                });

                // Gastos por regional (mês atual)
                const porRegional: Record<string, { total: number; count: number }> = {};
                items.filter(i => (i.data ?? "").startsWith(ym)).forEach((i) => {
                  const reg = repMap[i.user_id]?.regional ?? "Sem Regional";
                  if (!porRegional[reg]) porRegional[reg] = { total: 0, count: 0 };
                  porRegional[reg].total += Number(i.valor || 0);
                  porRegional[reg].count += 1;
                });

                const maxConsultor = Math.max(...Object.values(porConsultor).map(c => c.total), 1);
                const maxRegional = Math.max(...Object.values(porRegional).map(r => r.total), 1);

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Por consultor */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" /> Gastos por consultor — mês atual
                        </div>
                        {Object.keys(porConsultor).length === 0 ? (
                          <div className="text-xs text-muted-foreground">Nenhum lançamento no mês.</div>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(porConsultor)
                              .sort((a, b) => b[1].total - a[1].total)
                              .map(([uid, c]) => (
                                <div key={uid} className="space-y-0.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium truncate max-w-[140px]">{c.nome}</span>
                                    <span className="font-mono text-muted-foreground">{fmt(c.total)} <span className="opacity-60">({c.count})</span></span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(c.total / maxConsultor) * 100}%` }} />
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Por regional */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" /> Gastos por regional — mês atual
                        </div>
                        {Object.keys(porRegional).length === 0 ? (
                          <div className="text-xs text-muted-foreground">Nenhum lançamento no mês.</div>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(porRegional)
                              .sort((a, b) => b[1].total - a[1].total)
                              .map(([reg, r]) => (
                                <div key={reg} className="space-y-0.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium">{reg}</span>
                                    <span className="font-mono text-muted-foreground">{fmt(r.total)} <span className="opacity-60">({r.count})</span></span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${(r.total / maxRegional) * 100}%` }} />
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {/* Tabela completa todos os lançamentos */}
              <Card><CardContent className="p-0">
                <div className="p-3 border-b text-sm font-semibold">Todos os lançamentos da organização</div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Regional</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cupom</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {items.map((i) => {
                      const rep = reps.find(r => r.user_id === i.user_id);
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="text-xs">{i.data}</TableCell>
                          <TableCell className="text-xs font-medium">{rep?.nome ?? "—"}</TableCell>
                          <TableCell className="text-xs">{rep?.regional ?? "—"}</TableCell>
                          <TableCell className="capitalize text-xs">{i.categoria}</TableCell>
                          <TableCell className="text-xs">{[i.cidade, i.uf].filter(Boolean).join("/") || "—"}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmt(Number(i.valor))}</TableCell>
                          <TableCell><Badge variant={STATUS_COLORS[i.status]} className="text-[10px]">{i.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            {i.cupom_path && (
                              <Button size="icon" variant="ghost" onClick={() => verCupom(i.cupom_path)}>
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}
