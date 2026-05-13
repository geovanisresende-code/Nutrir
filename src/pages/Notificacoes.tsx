import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/AppShell";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { PushToggle } from "@/components/PushToggle";
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle2, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const typeIcon = (type: Notification["type"]) => {
  switch (type) {
    case "success": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error": return <AlertCircle className="w-4 h-4 text-destructive" />;
    default: return <Info className="w-4 h-4 text-primary" />;
  }
};

type Filtro = "todas" | "nao_lidas" | "info" | "success" | "warning" | "error";

export default function Notificacoes() {
  const { items, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications(200);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const lista = useMemo(() => {
    return items.filter(n => {
      if (filtro === "nao_lidas" && n.read_at) return false;
      if (filtro !== "todas" && filtro !== "nao_lidas" && n.type !== filtro) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          (n.message ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, busca, filtro]);

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary"/>Centro de notificações</span> as any}
        description="Histórico completo de eventos, alertas e ações da organização"
        actions={
          <div className="flex gap-2">
            <PushToggle />
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="w-4 h-4 mr-1"/>Marcar todas como lidas
              </Button>
            )}
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-4">
        <Card className="p-3 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título ou mensagem…"
              className="pl-9"
            />
          </div>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList>
              <TabsTrigger value="todas">Todas <Badge variant="secondary" className="ml-1.5 text-[10px]">{items.length}</Badge></TabsTrigger>
              <TabsTrigger value="nao_lidas">Não lidas <Badge variant="destructive" className="ml-1.5 text-[10px]">{unreadCount}</Badge></TabsTrigger>
              <TabsTrigger value="success">Sucesso</TabsTrigger>
              <TabsTrigger value="warning">Aviso</TabsTrigger>
              <TabsTrigger value="error">Erro</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Carregando notificações…</div>
          ) : lista.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2"/>
              <p className="text-sm text-muted-foreground">
                {busca || filtro !== "todas" ? "Nenhuma notificação corresponde aos filtros." : "Nenhuma notificação ainda."}
              </p>
            </div>
          ) : (
            <ul>
              {lista.map(n => (
                <li
                  key={n.id}
                  className={cn(
                    "flex gap-3 p-4 border-b last:border-0 hover:bg-muted/40 transition-colors",
                    !n.read_at && "bg-primary/5",
                  )}
                >
                  <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-tight", !n.read_at && "font-semibold")}>{n.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    {n.message && <p className="text-xs text-muted-foreground mt-1">{n.message}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      {n.link && (
                        <Link to={n.link} onClick={() => !n.read_at && markAsRead(n.id)}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            <ExternalLink className="w-3 h-3 mr-1"/>Abrir
                          </Button>
                        </Link>
                      )}
                      {!n.read_at && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markAsRead(n.id)}>
                          <CheckCheck className="w-3 h-3 mr-1"/>Marcar como lida
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
