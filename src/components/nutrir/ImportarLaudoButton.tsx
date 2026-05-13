import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { parseLaudoArquivo, type LaudoExtraido } from "@/lib/nutrir/laudo-parser";

interface Props {
  onLaudo: (laudo: LaudoExtraido) => void;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function ImportarLaudoButton({
  onLaudo,
  label = "Importar laudo (PDF/Excel)",
  variant = "outline",
  size = "default",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const laudo = await parseLaudoArquivo(file);
      onLaudo(laudo);
      const qtd = laudo.nutrientes.length;
      if (qtd === 0) {
        toast({
          title: "Nenhum nutriente detectado",
          description: laudo.alertas[0] ?? "Confira se o laudo possui doses em gr/ha ou kg/ha.",
          variant: "destructive",
        });
      } else {
        toast({
          title: `Laudo importado: ${qtd} nutrientes`,
          description: `Tipo: ${laudo.tipo} · aplicação: ${laudo.aplicacao_sugerida ?? "—"} · complexador: ${laudo.complexador_sugerido ?? "—"}`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro ao ler arquivo";
      toast({ title: "Falha ao importar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-1" />
        )}
        {loading ? "Lendo…" : label}
      </Button>
    </>
  );
}
