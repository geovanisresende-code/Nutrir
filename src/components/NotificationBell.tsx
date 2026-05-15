import { Bell, Check, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const typeIcon = (type: Notification["type"]) => {
  switch (type) {
    case "success": return <CheckCircle2 className="w-4 h-4 text-[#c49a30]" />;
    case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error": return <AlertCircle className="w-4 h-4 text-destructive" />;
    default: return <Info className="w-4 h-4 text-primary" />;
  }
};

export const NotificationBell = () => {
  const { items, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center rounded-full"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <div className="font-semibold text-sm">Notificações</div>
            <div className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} não ${unreadCount === 1 ? "lida" : "lidas"}` : "Tudo em dia"}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-1" /> Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {loading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>}
          {!loading && items.length === 0 && (
            <div className="p-8 text-center">
              <Bell className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação ainda</p>
            </div>
          )}
          {!loading && items.map((n) => {
            const content = (
              <div
                className={cn(
                  "flex gap-3 p-3 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer",
                  !n.read_at && "bg-primary/5"
                )}
              >
                <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm leading-tight", !n.read_at && "font-semibold")}>{n.title}</p>
                    {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} to={n.link} onClick={() => !n.read_at && markAsRead(n.id)}>
                {content}
              </Link>
            ) : (
              <div key={n.id} onClick={() => !n.read_at && markAsRead(n.id)}>
                {content}
              </div>
            );
          })}
        </ScrollArea>

        <div className="border-t p-2">
          <Link to="/app/notificacoes" className="block">
            <Button variant="ghost" size="sm" className="w-full justify-center text-xs">
              Ver todas no centro de notificações
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};
