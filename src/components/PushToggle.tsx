import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { pushPermission, requestPushPermission, pushEnabled, setPushEnabled } from "@/lib/push";
import { toast } from "sonner";

export function PushToggle() {
  const [perm, setPerm] = useState(pushPermission());
  const [enabled, setEnabled] = useState(pushEnabled());

  useEffect(() => {
    setPerm(pushPermission());
    setEnabled(pushEnabled());
  }, []);

  const click = async () => {
    if (perm === "unsupported") {
      toast.error("Seu navegador não suporta notificações.");
      return;
    }
    if (perm === "denied") {
      toast.error("Permissão bloqueada — habilite nas configurações do navegador.");
      return;
    }
    if (perm !== "granted") {
      const r = await requestPushPermission();
      setPerm(r);
      if (r === "granted") {
        setEnabled(true);
        toast.success("Notificações ativadas.");
      }
      return;
    }
    const next = !enabled;
    setPushEnabled(next);
    setEnabled(next);
    toast.success(next ? "Notificações ativadas." : "Notificações silenciadas.");
  };

  return (
    <Button variant="outline" size="sm" onClick={click}>
      {enabled ? <Bell className="w-4 h-4 mr-1" /> : <BellOff className="w-4 h-4 mr-1" />}
      {enabled ? "Push ligado" : "Ativar push"}
    </Button>
  );
}
