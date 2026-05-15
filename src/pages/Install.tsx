import { Smartphone, Share, Plus, Chrome, Apple } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const installedHandler = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") toast.success("App instalado!");
    setDeferred(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-2xl mx-auto py-12">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-4">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Instale o Nutrir</h1>
          <p className="text-muted-foreground mt-2">Adicione à tela inicial e use como um app de verdade.</p>
        </div>

        {installed && (
          <Card className="mb-6 border-[#d4a843]/30 bg-[#d4a843]/5">
            <CardContent className="pt-6 text-center">
              <Badge variant="secondary" className="bg-[#d4a843]/20 text-emerald-700">App instalado ✓</Badge>
              <p className="text-sm text-muted-foreground mt-2">Você está usando a versão instalada.</p>
            </CardContent>
          </Card>
        )}

        {deferred && !installed && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="pt-6 text-center">
              <p className="font-medium mb-3">Seu navegador suporta instalação direta.</p>
              <Button size="lg" onClick={triggerInstall}>Instalar agora</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Apple className="w-5 h-5" />
                <CardTitle className="text-lg">iPhone / iPad</CardTitle>
              </div>
              <CardDescription>Safari</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <Step n={1} icon={<Share className="w-4 h-4" />}>Toque no botão <b>Compartilhar</b> na barra inferior.</Step>
              <Step n={2} icon={<Plus className="w-4 h-4" />}>Escolha <b>Adicionar à Tela de Início</b>.</Step>
              <Step n={3}>Confirme em <b>Adicionar</b>.</Step>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Chrome className="w-5 h-5" />
                <CardTitle className="text-lg">Android</CardTitle>
              </div>
              <CardDescription>Chrome / Edge</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <Step n={1}>Abra o menu <b>⋮</b> no canto superior direito.</Step>
              <Step n={2}>Selecione <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</Step>
              <Step n={3}>Confirme.</Step>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-muted/40 text-sm text-muted-foreground">
          💡 <b>Modo campo:</b> mesmo sem internet, você pode iniciar uma rota de coleta e capturar pontos GPS.
          Os dados ficam salvos no aparelho e sincronizam automaticamente quando o sinal voltar.
        </div>
      </div>
    </div>
  );
}

const Step = ({ n, icon, children }: { n: number; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">{n}</div>
    <div className="flex-1 flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span>{children}</span>
    </div>
  </div>
);
