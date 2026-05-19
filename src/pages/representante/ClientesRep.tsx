import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { PageHeader } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Plus, ChevronRight, ClipboardList, Phone,
  MapPin, AlertCircle, CheckCircle2, Clock,
} from "lucide-react";

interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  categoria: string;
  ativo: boolean;
}

type Filtro = "todos" | "urgente" | "atencao" | "ok";

const diasSemVisita = (ultima: string | null): number => {
  if (!ultima) return 9999;
  return Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000);
};

const statusVisita = (dias: number) => {
  if (dias >= 30) return { cor: "text-red-600", bg: "bg-red-50 border-red-200", icone: AlertCircle, label: "Sem visita" };
  if (dias >= 15) return { cor: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", icone: Clock, label: "Faz tempo" };
  return { cor: "text-green-600", bg: "bg-green-50 border-green-200", icone: CheckCircle2, label: "Recente" };
};

const CATEGORIA_LABEL: Record<string, string> = {
  produtor_rural: "Produtor", grupo: "Grupo", revenda: "Revenda",
  b2b: "B2B", cooperativa: "Cooperativa",
};

export default function ClientesRep() {
  const { current } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: clientes, loading } = useOrgTable<Cliente>("nutrir_clientes", {
    orderBy: "razao_social",
    select: "id,razao_social,nome_fantasia,cidade,uf,telefone,categoria,ativo",
    filter: (q: any) => q.eq("ativo", true),
  });

  const [ultimasVisitas, setUltimasVisitas] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // Carrega a data da última visita de cada cliente (do usuário logado)
  useEffect(() => {
    if (!current || !user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("nutrir_visitas")
        .select("cliente_id,data_visita")
        .eq("organization_id", current.id)
        .eq("user_id", user.id)
        .order("data_visita", { ascending: false });

      const map: Record<string, string> = {};
      (data ?? []).forEach((v: any) => {
        if (v.cliente_id && !map[v.cliente_id]) map[v.cliente_id] = v.data_visita;
      });
      setUltimasVisitas(map);
    })();
  }, [current, user]);

  const clientesComStatus = useMemo(() => {
    return clientes.map((c) => {
      const ultima = ultimasVisitas[c.id] ?? null;
      const dias = diasSemVisita(ultima);
      return { ...c, ultima, dias };
    });
  }, [clientes, ultimasVisitas]);

  const filtrados = useMemo(() => {
    let lista = clientesComStatus;

    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(
        (c) =>
          c.razao_social.toLowerCase().includes(q) ||
          (c.nome_fantasia ?? "").toLowerCase().includes(q) ||
          (c.cidade ?? "").toLowerCase().includes(q),
      );
    }

    if (filtro === "urgente") lista = lista.filter((c) => c.dias >= 30);
    else if (filtro === "atencao") lista = lista.filter((c) => c.dias >= 15 && c.dias < 30);
    else if (filtro === "ok") lista = lista.filter((c) => c.dias < 15);

    return lista.sort((a, b) => b.dias - a.dias); // prioriza sem visita
  }, [clientesComStatus, busca, filtro]);

  const counts = useMemo(() => ({
    urgente: clientesComStatus.filter((c) => c.dias >= 30).length,
    atencao: clientesComStatus.filter((c) => c.dias >= 15 && c.dias < 30).length,
    ok: clientesComStatus.filter((c) => c.dias < 15).length,
  }), [clientesComStatus]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Carregando clientes…</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader
        title="Clientes"
        description={`${clientes.length} clientes ativos`}
        action={
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/app/nutrir/clientes")}>
            <Plus className="h-3.5 w-3.5" /> Novo
          </Button>
        }
      />

      {/* Busca */}
      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou cidade…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* Filtros de status de visita */}
      <div className="px-4 flex gap-2 flex-wrap">
        {(
          [
            { id: "todos", label: "Todos", count: clientes.length },
            { id: "urgente", label: "🔴 Sem visita", count: counts.urgente },
            { id: "atencao", label: "🟡 Faz tempo", count: counts.atencao },
            { id: "ok", label: "🟢 Recentes", count: counts.ok },
          ] as const
        ).map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filtro === f.id ? "default" : "outline"}
            className="gap-1.5 h-8 text-xs"
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
            <Badge
              variant={filtro === f.id ? "secondary" : "outline"}
              className="ml-1 h-4 px-1 text-[10px]"
            >
              {f.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Lista */}
      <div className="px-4 flex flex-col gap-2">
        {filtrados.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {busca ? "Nenhum cliente encontrado para essa busca." : "Nenhum cliente neste filtro."}
          </div>
        )}

        {filtrados.map((c) => {
          const status = statusVisita(c.dias);
          const StatusIcon = status.icone;
          const nome = c.nome_fantasia || c.razao_social;

          return (
            <Card
              key={c.id}
              className={`cursor-pointer hover:shadow-md transition-all border ${status.bg}`}
              onClick={() => navigate(`/app/rep/clientes/${c.id}`)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                {/* Ícone de status */}
                <div className={`shrink-0 ${status.cor}`}>
                  <StatusIcon className="h-5 w-5" />
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{nome}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {CATEGORIA_LABEL[c.categoria] ?? c.categoria}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {(c.cidade || c.uf) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[c.cidade, c.uf].filter(Boolean).join(" / ")}
                      </span>
                    )}
                    {c.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.telefone}
                      </span>
                    )}
                  </div>

                  {/* Última visita */}
                  <div className={`text-[11px] mt-1 font-medium ${status.cor}`}>
                    {c.ultima
                      ? `Última visita: ${new Date(c.ultima).toLocaleDateString("pt-BR")} (${
                          c.dias === 0 ? "hoje" : c.dias === 1 ? "ontem" : `${c.dias}d atrás`
                        })`
                      : "Nenhuma visita registrada"}
                  </div>
                </div>

                {/* Ação rápida */}
                <div className="shrink-0 flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/app/rep/visitas?cliente=${c.id}`);
                    }}
                    title="Nova visita"
                  >
                    <ClipboardList className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
