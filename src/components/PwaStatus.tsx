import { useEffect, useState } from "react";
import { WifiOff, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaStatus() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);

    // Registra service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      // mostra apenas uma vez por sessão
      if (!sessionStorage.getItem("pwa.install.dismissed")) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowInstall(false);
  };

  const dismiss = () => {
    setShowInstall(false);
    sessionStorage.setItem("pwa.install.dismissed", "1");
  };

  return (
    <>
      {!online && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-amber-950 text-xs py-1.5 px-3 flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Você está offline — algumas ações podem não funcionar até reconectar.</span>
        </div>
      )}

      {showInstall && installPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-card border shadow-lg rounded-lg p-3 flex items-start gap-3">
          <div className="bg-primary/10 text-primary p-2 rounded-md">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">Instalar Nutrir</div>
            <div className="text-xs text-muted-foreground mb-2">
              Acesse mais rápido e use direto da tela inicial do seu celular.
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={install}>Instalar</Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
            </div>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
