import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, ShoppingCart, ClipboardList, Boxes,
  MapPin, TestTube, Phone, Building2, Globe, Calendar,
  Calculator, TrendingUp, Package,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cliente {
  id: string; razao_social: string; nome_fantasia: string | null;
  cidade: string | null; uf: string | null; telefone: string | null;
  whatsapp: string | null; email: string | null; cnpj: string | null;
  categoria: string | null; ativo: boolean;
  regional?: { nome: string } | null;
}

interface Visita {
  id: string; data_visita: string; motivo: string; relato: string;
  alerta_nivel: string | null;
}

interface Pedido {
  id: string; created_at: string; status: string; valor_total: number | null;
  numero_pedido: number | null;
}

interface Estoque {
  id: string; produto_nome: string; quantidade: number; unidade: string;
}

const MOTIVO_LABEL: Record<string, string> = {
  rotina_relacionamento: "Rotina", prospeccao_venda: "Prospecção",
  acompanhamento_teste: "Acomp. Teste", entrega_produto: "Entrega",
  geracao_demanda: "Geração de Demanda", dia_de_campo: "Dia de Campo",
  outro: "Outro",
};

const ALERTA_COLOR: Record<string, string> = {
  muito_urgente: "destructive",
  ponto_atencao: "outline",
  relato_rotina: "secondary",
};

const STATUS_COLOR: Record<string, string> = {
  rascunho: "secondary", pendente: "outline", aprovado: "default",
  faturado: "default", cancelado: "destructive",
};

export default function ClienteFicha() {
  const { id } = useParams<{ id: string }>();
  const { current } = useOrg();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [estoque, setEstoque] = useState<Estoque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !current) return;
    (async () => {
      setLoading(true);
      const [cRes, vRes, pRes, eRes] = await Promise.all([
        (supabase as any).from("nutrir_clientes")
          .select("*,regional:nutrir_regionais(nome)")
          .eq("id", id).single(),
        (supabase as any).from("nutrir_visitas")
          .select("id,data_visita,motivo,relato,alerta_nivel")
          .eq("cliente_id", id)
          .order("data_visita", { ascending: false })
          .limit(10),
        (supabase as any).from("nutrir_pedidos")
          .select("id,created_at,status,valor_total,numero_pedido")
          .eq("cliente_id", id)
          .order("created_at", { ascending: false })
          .limit(10),
        (supabase as any).from("nutrir_estoque_cliente")
          .select("id,produto_nome,quantidade,unidade")
          .eq("cliente_id", id)
          .order("produto_nome"),
      ]);
      if (cRes.error) toast({ title: "Erro ao carregar cliente", variant: "destructive" });
      setCliente(cRes.data);
      setVisitas(vRes.data ?? []);
      setPedidos(pRes.data ?? []);
      setEstoque(eRes.data ?? []);
      setLoading(false);
    })();
  }, [id, current]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!cliente) return <div className="p-8 text-center text-muted-foreground">Cliente não encontrado.</div>;

  const nome = cliente.nome_fantasia || cliente.razao_social;

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header */}
      <div className="px-4 pt-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">{nome}</h1>
          <p className="text-xs text-muted-foreground">
            {cliente.cidade}{cliente.uf ? ` / ${cliente.uf}` : ""}
            {cliente.regional?.nome ? ` · ${cliente.regional.nome}` : ""}
          </p>
        </div>
        <Badge variant={cliente.ativo ? "default" : "secondary"}>
          {cliente.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      {/* Ações rápidas */}
      <div className="px-4 flex gap-2 flex-wrap">
        <Button size="sm" className="gap-1.5" onClick={() => navigate(`/app/rep/visitas?cliente=${id}`)}>
          <ClipboardList className="h-3.5 w-3.5" /> Nova Visita
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/app/rep/pedidos?cliente=${id}`)}>
          <ShoppingCart className="h-3.5 w-3.5" /> Novo Pedido
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/app/nutrir")}>
          <Calculator className="h-3.5 w-3.5" /> Calcular
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/app/rep/talhoes?cliente=${id}`)}>
          <MapPin className="h-3.5 w-3.5" /> Talhões
        </Button>
      </div>

      {/* Dados do cliente */}
      <div className="px-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cliente.telefone && (
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Telefone</p>
            <p className="text-sm font-medium">{cliente.telefone}</p>
          </Card>
        )}
        {cliente.cnpj && (
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">CNPJ</p>
            <p className="text-sm font-medium">{cliente.cnpj}</p>
          </Card>
        )}
        {cliente.categoria && (
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Categoria</p>
            <p className="text-sm font-medium capitalize">{cliente.categoria.replace("_", " ")}</p>
          </Card>
        )}
        {cliente.email && (
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">E-mail</p>
            <p className="text-sm font-medium truncate">{cliente.email}</p>
          </Card>
        )}
      </div>

      {/* Tabs: Visitas / Pedidos / Estoque */}
      <div className="px-4">
        <Tabs defaultValue="visitas">
          <TabsList>
            <TabsTrigger value="visitas" className="gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Visitas ({visitas.length})
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" />
              Pedidos ({pedidos.length})
            </TabsTrigger>
            <TabsTrigger value="estoque" className="gap-1.5">
              <Boxes className="h-3.5 w-3.5" />
              Estoque ({estoque.length})
            </TabsTrigger>
          </TabsList>

          {/* Visitas */}
          <TabsContent value="visitas" className="mt-3 space-y-2">
            {visitas.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma visita registrada.
                <div className="mt-2">
                  <Button size="sm" onClick={() => navigate(`/app/rep/visitas?cliente=${id}`)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Registrar primeira visita
                  </Button>
                </div>
              </div>
            )}
            {visitas.map(v => (
              <Card key={v.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">
                        {format(new Date(v.data_visita), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {MOTIVO_LABEL[v.motivo] ?? v.motivo}
                      </Badge>
                      {v.alerta_nivel && (
                        <Badge variant={(ALERTA_COLOR[v.alerta_nivel] as any) ?? "outline"} className="text-[10px]">
                          {v.alerta_nivel === "muito_urgente" ? "🔴 Urgente" : v.alerta_nivel === "ponto_atencao" ? "🟡 Atenção" : "🟢 Rotina"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{v.relato}</p>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Pedidos */}
          <TabsContent value="pedidos" className="mt-3 space-y-2">
            {pedidos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum pedido.
                <div className="mt-2">
                  <Button size="sm" onClick={() => navigate(`/app/rep/pedidos?cliente=${id}`)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Fazer pedido
                  </Button>
                </div>
              </div>
            )}
            {pedidos.map(p => (
              <Card key={p.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {p.numero_pedido ? `#${p.numero_pedido}` : "Pedido"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "dd MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.valor_total != null && (
                    <span className="text-sm font-semibold">
                      {p.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  )}
                  <Badge variant={(STATUS_COLOR[p.status] as any) ?? "outline"} className="text-[10px]">
                    {p.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Estoque */}
          <TabsContent value="estoque" className="mt-3 space-y-2">
            {estoque.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Sem estoque registrado para este cliente.
              </div>
            )}
            {estoque.map(e => (
              <Card key={e.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{e.produto_nome}</span>
                </div>
                <span className="text-sm font-semibold">
                  {e.quantidade} {e.unidade}
                </span>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
