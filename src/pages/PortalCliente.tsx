import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Receipt, ShoppingCart, TestTube, Boxes } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function PortalCliente() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${SUPABASE_URL}/functions/v1/portal-cliente?token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (err) return <div className="min-h-screen flex items-center justify-center"><Card className="max-w-md"><CardContent className="p-6 text-center"><p className="text-red-600 font-medium">Acesso inválido</p><p className="text-sm text-muted-foreground mt-2">{err}</p></CardContent></Card></div>;
  if (!data?.cliente) return null;

  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-primary text-primary-foreground p-6">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Building2 className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">{data.cliente.nome_fantasia || data.cliente.razao_social}</h1>
            <p className="text-sm opacity-90">Portal do Cliente</p>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" />Contas a Receber</CardTitle></CardHeader>
            <CardContent>
              {data.contas.length === 0 ? <p className="text-sm text-muted-foreground">Sem títulos em aberto</p> :
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {data.contas.map((c: any) => <div key={c.id} className="flex justify-between text-sm border-b pb-2">
                    <div><p className="font-medium">NF {c.numero_nf ?? "-"} · Parc. {c.parcela}/{c.parcelas_total}</p><p className="text-xs text-muted-foreground">Venc: {new Date(c.data_vencimento + "T12:00").toLocaleDateString("pt-BR")}</p></div>
                    <div className="text-right"><p className="font-semibold">{fmt(c.valor)}</p><Badge variant={c.status === "pago" ? "default" : "secondary"} className="text-xs">{c.status}</Badge></div>
                  </div>)}
                </div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Pedidos</CardTitle></CardHeader>
            <CardContent>
              {data.pedidos.length === 0 ? <p className="text-sm text-muted-foreground">Sem pedidos</p> :
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {data.pedidos.map((p: any) => <div key={p.id} className="flex justify-between text-sm border-b pb-2">
                    <div><p className="font-medium">{p.numero ?? p.id.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p></div>
                    <div className="text-right"><p className="font-semibold">{fmt(p.valor_total ?? 0)}</p><Badge variant="outline" className="text-xs">{p.status}</Badge></div>
                  </div>)}
                </div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TestTube className="h-4 w-4" />Campos de Teste</CardTitle></CardHeader>
            <CardContent>
              {data.campos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum campo</p> :
                <div className="space-y-2">
                  {data.campos.map((c: any) => <div key={c.id} className="text-sm border-b pb-2">
                    <p className="font-medium">{c.titulo}</p>
                    <p className="text-xs text-muted-foreground">{c.cultura} · {c.area_total_ha} ha · <Badge variant="outline" className="text-[10px]">{c.status}</Badge></p>
                  </div>)}
                </div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4" />Estoque na propriedade</CardTitle></CardHeader>
            <CardContent>
              {data.estoque.length === 0 ? <p className="text-sm text-muted-foreground">Sem produtos</p> :
                <div className="space-y-1">
                  {data.estoque.map((e: any) => <div key={e.id} className="flex justify-between text-sm border-b pb-1">
                    <span>{e.produto_nome}</span><span className="font-medium">{Number(e.saldo).toLocaleString("pt-BR")} {e.unidade}</span>
                  </div>)}
                </div>}
            </CardContent>
          </Card>
        </div>
        <p className="text-center text-xs text-muted-foreground">Acesso seguro via token único · Nutrir</p>
      </main>
    </div>
  );
}
