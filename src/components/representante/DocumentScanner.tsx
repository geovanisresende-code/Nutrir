import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Camera, RotateCw, Sparkles, Eraser, Check, Upload, FileText,
} from "lucide-react";

/*
  DocumentScanner — captura uma foto da câmera (ou upload) e aplica
  filtros de melhoria de imagem estilo CamScanner:
    • Aumento de contraste
    • Equalização tonal (clareia papel, escurece tinta)
    • Filtro "preto e branco" opcional (alto contraste pra texto)
    • Rotação 90°
  No final, devolve um File (jpg comprimido) para upload no Supabase.
*/

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCapture: (file: File) => void | Promise<void>;
};

export default function DocumentScanner({ open, onOpenChange, onCapture }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [contrast, setContrast] = useState(40);     // -100 a 100
  const [brightness, setBrightness] = useState(15); // -100 a 100
  const [bw, setBw] = useState(false);
  const [rotation, setRotation] = useState(0);      // graus
  const [processing, setProcessing] = useState(false);

  const reset = () => {
    setImgUrl(null);
    setContrast(40); setBrightness(15); setBw(false); setRotation(0);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Quando o usuário escolhe um arquivo / tira foto
  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImgUrl(url);
  };

  // Aplica filtros e desenha no canvas
  useEffect(() => {
    if (!imgUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Ajusta tamanho conforme rotação
      const rotated = rotation % 180 !== 0;
      canvas.width = rotated ? img.height : img.width;
      canvas.height = rotated ? img.width : img.height;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      // Aplica contraste + brilho + opcional grayscale
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      const c = (contrast + 100) / 100;     // 0..2
      const b = brightness * 2.55;          // -255..255
      for (let i = 0; i < px.length; i += 4) {
        let r = px[i], g = px[i + 1], bl = px[i + 2];
        r = (r - 128) * c + 128 + b;
        g = (g - 128) * c + 128 + b;
        bl = (bl - 128) * c + 128 + b;
        if (bw) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
          r = g = bl = lum > 140 ? 255 : 0;
        }
        px[i]     = Math.max(0, Math.min(255, r));
        px[i + 1] = Math.max(0, Math.min(255, g));
        px[i + 2] = Math.max(0, Math.min(255, bl));
      }
      ctx.putImageData(data, 0, 0);
    };
    img.src = imgUrl;
  }, [imgUrl, contrast, brightness, bw, rotation]);

  // Salva o canvas como File JPG e devolve
  const aceitar = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setProcessing(true);
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) { setProcessing(false); return; }
    const file = new File(
      [blob],
      `nf-scan-${Date.now()}.jpg`,
      { type: "image/jpeg" },
    );
    await onCapture(file);
    setProcessing(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />Scanner de Nota Fiscal
          </DialogTitle>
        </DialogHeader>

        {!imgUrl ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Capture uma foto da nota fiscal ou cupom. O scanner vai aumentar contraste e clarear o fundo automaticamente.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline" className="h-auto py-6 flex-col gap-2"
                onClick={() => {
                  inputRef.current?.setAttribute("capture", "environment");
                  inputRef.current?.click();
                }}
              >
                <Camera className="w-6 h-6" />
                <span>Câmera</span>
                <span className="text-xs text-muted-foreground">Tirar foto</span>
              </Button>
              <Button
                variant="outline" className="h-auto py-6 flex-col gap-2"
                onClick={() => {
                  inputRef.current?.removeAttribute("capture");
                  inputRef.current?.click();
                }}
              >
                <Upload className="w-6 h-6" />
                <span>Galeria</span>
                <span className="text-xs text-muted-foreground">Escolher arquivo</span>
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePick}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border rounded overflow-hidden bg-muted/30 flex items-center justify-center max-h-[50vh]">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[50vh] object-contain"
              />
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Contraste</span>
                  <span className="font-mono">{contrast}</span>
                </div>
                <Slider min={-100} max={100} step={5} value={[contrast]} onValueChange={(v) => setContrast(v[0])} />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Brilho</span>
                  <span className="font-mono">{brightness}</span>
                </div>
                <Slider min={-100} max={100} step={5} value={[brightness]} onValueChange={(v) => setBrightness(v[0])} />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={bw ? "default" : "outline"} onClick={() => setBw(!bw)}>
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Preto & Branco (alto contraste)
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
                  <RotateCw className="w-3.5 h-3.5 mr-1" />Girar
                </Button>
                <Button size="sm" variant="ghost" onClick={reset} className="ml-auto">
                  <Eraser className="w-3.5 h-3.5 mr-1" />Limpar
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={aceitar} disabled={!imgUrl || processing}>
            <Check className="w-4 h-4 mr-1" />
            {processing ? "Salvando..." : "Usar este scan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
