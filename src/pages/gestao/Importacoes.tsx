import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Entity = "clientes" | "produtos";

interface Schema {
  table: string;
  fields: { key: string; label: string; required?: boolean }[];
  example: Record<string, string>;
}

const SCHEMAS: Record<Entity, Schema> = {
  clientes: {
    table: "nutrir_clientes",
    fields: [
      { key: "razao_social", label: "razao_social", required: true },
      { key: "nome_fantasia", label: "nome_fantasia" },
      { key: "cnpj", label: "cnpj" },
      { key: "cpf", label: "cpf" },
      { key: "email", label: "email" },
      { key: "telefone", label: "telefone" },
      { key: "whatsapp", label: "whatsapp" },
      { key: "cidade", label: "cidade" },
      { key: "uf", label: "uf" },
      { key: "endereco", label: "endereco" },
    ],
    example: {
      razao_social: "Fazenda São João LTDA",
      nome_fantasia: "Faz. São João",
      cnpj: "12.345.678/0001-90",
      email: "contato@saojoao.com",
      telefone: "(64) 99999-1111",
      whatsapp: "(64) 99999-1111",
      cidade: "Goiânia",
      uf: "GO",
      endereco: "Rod. GO-020, km 10",
    },
  },
  produtos: {
    table: "nutrir_produtos",
    fields: [
      { key: "nome", label: "nome", required: true },
      { key: "codigo", label: "codigo" },
      { key: "categoria", label: "categoria" },
      { key: "unidade", label: "unidade" },
      { key: "preco_litro", label: "preco_litro" },
      { key: "ativo", label: "ativo (true/false)" },
    ],
    example: {
      nome: "Bio Cálcio 200",
      codigo: "BC200",
      categoria: "foliar",
      unidade: "L",
      preco_litro: "45.00",
      ativo: "true",
    },
  },
};

interface ParsedRow {
  data: Record<string, any>;
  errors: string[];
  ok: boolean;
}

export default function Importacoes() {
  const { current: org } = useOrg();
  const [entity, setEntity] = useState<Entity>("clientes");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [importing, setImporting] = useState(false);

  const schema = SCHEMAS[entity];

  const baixarTemplate = () => {
    const csv = Papa.unparse({
      fields: schema.fields.map((f) => f.key),
      data: [schema.example],
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `template-${entity}.csv`;
    link.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const validKeys = schema.fields.map((f) => f.key);
        const parsed: ParsedRow[] = res.data.map((raw) => {
          const data: Record<string, any> = {};
          const errors: string[] = [];
          for (const key of validKeys) {
            const v = raw[key];
            if (v !== undefined && v !== "") data[key] = v;
          }
          // valida obrigatórios
          schema.fields
            .filter((f) => f.required)
            .forEach((f) => {
              if (!data[f.key]) errors.push(`${f.key} obrigatório`);
            });
          // converte tipos simples
          if (entity === "produtos") {
            if (data.preco_litro) data.preco_litro = Number(String(data.preco_litro).replace(",", "."));
            if (data.ativo !== undefined) data.ativo = String(data.ativo).toLowerCase() === "true";
          }
          return { data, errors, ok: errors.length === 0 };
        });
        setRows(parsed);
        toast.success(`${parsed.length} linha(s) lida(s) — ${parsed.filter((r) => r.ok).length} válida(s)`);
      },
      error: (err) => toast.error(`Erro ao ler CSV: ${err.message}`),
    });
  };

  const importar = async () => {
    if (!org) return;
    const validas = rows.filter((r) => r.ok).map((r) => ({ ...r.data, organization_id: org.id }));
    if (validas.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }
    setImporting(true);
    try {
      const chunkSize = 100;
      let total = 0;
      for (let i = 0; i < validas.length; i += chunkSize) {
        const chunk = validas.slice(i, i + chunkSize);
        const { error } = await supabase.from(schema.table as any).insert(chunk as any);
        if (error) throw error;
        total += chunk.length;
      }
      toast.success(`✅ ${total} registro(s) importado(s) em ${schema.table}.`);
      setRows([]);
      setFilename("");
    } catch (e: any) {
      toast.error(`Falha: ${e?.message ?? e}`);
    } finally {
      setImporting(false);
    }
  };

  const validas = rows.filter((r) => r.ok).length;
  const invalidas = rows.length - validas;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" /> Importação em massa
        </h1>
        <p className="text-sm text-muted-foreground">
          Suba uma planilha CSV para cadastrar dados em lote. Baixe o template para ver o formato esperado.
        </p>
      </div>

      <Tabs value={entity} onValueChange={(v) => { setEntity(v as Entity); setRows([]); setFilename(""); }}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value={entity} className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Baixe o modelo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <Button variant="outline" onClick={baixarTemplate}>
                <Download className="h-4 w-4 mr-2" /> Baixar template CSV
              </Button>
              <div className="text-xs text-muted-foreground">
                Campos obrigatórios:{" "}
                {schema.fields.filter((f) => f.required).map((f) => f.key).join(", ")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Suba seu arquivo</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-3 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/30 transition">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div>
                  <div className="font-medium">{filename || "Clique para selecionar um CSV"}</div>
                  <div className="text-xs text-muted-foreground">
                    Aceita .csv com cabeçalho na primeira linha
                  </div>
                </div>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              </label>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  3. Pré-visualização
                  <span className="ml-3 text-sm font-normal">
                    <Badge variant="secondary" className="mr-1">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {validas} válida(s)
                    </Badge>
                    {invalidas > 0 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" /> {invalidas} com erro
                      </Badge>
                    )}
                  </span>
                </CardTitle>
                <Button onClick={importar} disabled={importing || validas === 0}>
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Importar {validas} linha(s)
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-auto max-h-[420px]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Status</th>
                        {schema.fields.slice(0, 5).map((f) => (
                          <th key={f.key} className="text-left p-2">{f.key}</th>
                        ))}
                        <th className="text-left p-2">Erros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 200).map((r, i) => (
                        <tr key={i} className={`border-t ${r.ok ? "" : "bg-destructive/5"}`}>
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2">
                            {r.ok ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </td>
                          {schema.fields.slice(0, 5).map((f) => (
                            <td key={f.key} className="p-2 truncate max-w-[180px]">
                              {String(r.data[f.key] ?? "—")}
                            </td>
                          ))}
                          <td className="p-2 text-destructive text-[11px]">
                            {r.errors.join("; ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 200 && (
                    <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                      Exibindo as primeiras 200 linhas. Todas serão importadas.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
