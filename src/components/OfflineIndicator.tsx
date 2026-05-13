import { Wifi, WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { cn } from "@/lib/utils";

export const OfflineIndicator = () => {
  const { online, pending, syncing, sync } = useOfflineSync();

  if (online && pending === 0) {
    return (
      <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wifi className="w-3.5 h-3.5 text-emerald-500" />
        <span>Online</span>
      </div>
    );
  }

  if (!online) {
    return (
      <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-600/30 bg-amber-500/10">
        <WifiOff className="w-3 h-3" />
        Offline {pending > 0 && `· ${pending} pendente${pending === 1 ? "" : "s"}`}
      </Badge>
    );
  }

  // online && pending > 0
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={sync}
      disabled={syncing}
      className="h-7 gap-1.5 text-xs"
    >
      {syncing ? <RefreshCw className={cn("w-3.5 h-3.5 animate-spin")} /> : <CloudUpload className="w-3.5 h-3.5" />}
      {syncing ? "Sincronizando…" : `Sincronizar ${pending}`}
    </Button>
  );
};
