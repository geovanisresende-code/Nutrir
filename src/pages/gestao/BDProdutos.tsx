import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Search, DollarSign, UploadCloud, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Produto = {
  id: string;
  nome: string;
  linha: string | null;
  descricao: string | null;
  custo_industria: number | null;
  dose_recomendada: string | null;
  categoria: string | null;
  imagem_url: string | null;
};

const CAT_COLOR: Record<string, string> = {
  DIAMANTE: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  OURO: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  PRATA: "bg-slate-400/10 text-slate-600 border-slate-400/30",
  BRONZE: "bg-amber-700/10 text-amber-700 border-amber-700/30",
};

const fmtBRL = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default function BDProdutos() {
  const [items, setItems] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ ok: number; fail: number; total: number }>({ ok: 0, fail: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  async function loadProdutos() {
    const { data } = await supabase
      .from("nutrir_produtos")
      .select("id,nome,linha,descricao,custo_industria,dose_recomendada,categoria,imagem_url")
      .eq("ativo", true)
      .order("linha", { ascending: true })
      .order("nome", { ascending: true });
    setItems((data as Produto[]) || []);
    setLoading(false);
  }

  useEffect(() => { loadProdutos(); }, []);

  async function handleBulkUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0, fail = 0;
    setProgress({ ok: 0, fail: 0, total: files.length });
    const idx = new Map(items.map((p) => [normalize(p.nome), p]));

    for (const file of Array.from(files)) {
      const key = normalize(file.name);
      let prod = idx.get(key);
      if (!prod) prod = items.find((p) => normalize(p.nome).includes(key) || key.includes(normalize(p.nome)));
      if (!prod) { fail++; setProgress((p) => ({ ...p, fail: p.fail + 1 })); continue; }

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${prod.id}.${ext}`;
      const up = await supabase.storage.from("produto-imagens").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) { fail++; setProgress((p) => ({ ...p, fail: p.fail + 1 })); continue; }

      const { data: pub } = supabase.storage.from("produto-imagens").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const upd = await supabase.from("nutrir_produtos").update({ imagem_url: url }).eq("id", prod.id);
      if (upd.error) { fail++; setProgress((p) => ({ ...p, fail: p.fail + 1 })); continue; }
      ok++; setProgress((p) => ({ ...p, ok: p.ok + 1 }));
    }

    setUploading(false);
    toast.success(`Upload concluído: ${ok} sucesso, ${fail} sem correspondência.`);
    if (fileRef.current) fileRef.current.value = "";
    loadProdutos();
  }

  const grouped = useMemo(() => {
    const filtered = items.filter((p) =>
      !q ||
      p.nome.toLowerCase().includes(q.toLowerCase()) ||
      (p.descricao || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.linha || "").toLowerCase().includes(q.toLowerCase()),
    );
    const map = new Map<string, Produto[]>();
    for (const p of filtered) {
      const k = p.linha || "Sem linha";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items, q]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Banco de Dados de Produtos
          </h1>
          <p className="text-muted-foreground text-sm">
            {items.length} produtos · {grouped.length} linhas
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto, descrição, linha..." className="pl-9" />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleBulkUpload(e.target.files)}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Os nomes dos arquivos devem corresponder aos nomes dos produtos."
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
            {uploading ? `Enviando ${progress.ok + progress.fail}/${progress.total}` : "Upload em massa"}
          </Button>
        </div>
      </div>
      {uploading && (
        <p className="text-xs text-muted-foreground">
          Progresso: {progress.ok} enviados · {progress.fail} sem correspondência · {progress.total - progress.ok - progress.fail} restantes
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum produto encontrado.</CardContent></Card>
      ) : (
        grouped.map(([linha, prods]) => (
          <section key={linha} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{linha}</h2>
              <Badge variant="outline">{prods.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {prods.map((p) => (
                <Card key={p.id} className="hover:shadow-elegant transition-base">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">{p.nome}</CardTitle>
                      {p.categoria && (
                        <Badge variant="outline" className={CAT_COLOR[p.categoria] || ""}>{p.categoria}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground line-clamp-2 min-h-[2.5rem]">{p.descricao || "—"}</p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Dose: {p.dose_recomendada || "—"}</span>
                      <span className="font-semibold flex items-center gap-1 text-primary">
                        <DollarSign className="h-3 w-3" />
                        {fmtBRL(p.custo_industria)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
