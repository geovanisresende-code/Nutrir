import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, Upload, Sparkles, RotateCw, Image as ImgIcon, Check, X } from "lucide-react";
import { toast } from "sonner";

/*
  Scanner de Nota Fiscal / Cupom — UX estilo CamScanner.
   - Captura por câmera (rear) ou upload de arquivo
   - Aplica filtro de scan (auto contraste + brilho + nitidez + threshold opcional)
   - Permite girar 90°
   - Retorna o Blob processado pra upload
   - Sem dependências externas (Canvas API puro)
*/

type Mode = "color" | "bw" | "magic";

interface ScannerNFProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanned: (blob: Blob) => void;
}

export function ScannerNF({ open, onOpenChange, onScanned }: ScannerNFProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [orig, setOrig] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<Mode>("magic");
  const [rotation, setRotation] = useState(0);
  const [processing, setProcessing] = useState(false);

  // Re-renderiza preview quando muda imagem/modo/rotação
  useEffect(() => {
    if (!orig || !canvasRef.current) return;
    drawPreview(canvasRef.current, orig, mode, rotation);
  }, [orig, mode, rotation]);

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { toast.error("Arquivo > 12MB"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setOrig(img); URL.revokeObjectURL(url); setRotation(0); };
    img.src = url;
  };

  const reset = () => { setOrig(null); setRotation(0); setMode("magic"); };

  const confirmar = async () => {
    if (!canvasRef.current || !orig) return;
    setProcessing(true);
    canvasRef.current.toBlob((blob) => {
      if (!blob) { toast.error("Falha ao processar imagem"); setProcessing(false); return; }
      onScanned(blob);
      reset();
      onOpenChange(false);
      setProcessing(false);
    }, "image/jpeg", 0.92);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImgIcon className="w-5 h-5" /> Escanear Nota / Cupom
          </DialogTitle>
        </DialogHeader>

        {!orig ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Tire uma foto direto da câmera ou escolha um arquivo. A imagem será otimizada automaticamente.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <Button onClick={() => camRef.current?.click()} className="bg-gradient-primary h-auto py-6 flex-col gap-2">
                <Camera className="w-6 h-6" />
                <span>Tirar foto</span>
              </Button>
              <Button onClick={() => fileRef.current?.click()} variant="outline" className="h-auto py-6 flex-col gap-2">
                <Upload className="w-6 h-6" />
                <span>Escolher arquivo</span>
              </Button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={e => onFile(e.target.files?.[0] ?? null)} />
            <input ref={fileRef} type="file" accept="image/*"
              className="hidden" onChange={e => onFile(e.target.files?.[0] ?? null)} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border rounded-md overflow-hidden bg-muted/20 grid place-items-center">
              <canvas ref={canvasRef} className="max-h-[55vh] max-w-full object-contain" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button size="sm" variant={mode === "magic" ? "default" : "outline"} onClick={() => setMode("magic")}>
                <Sparkles className="w-3.5 h-3.5 mr-1" />Auto
              </Button>
              <Button size="sm" variant={mode === "color" ? "default" : "outline"} onClick={() => setMode("color")}>
                Original
              </Button>
              <Button size="sm" variant={mode === "bw" ? "default" : "outline"} onClick={() => setMode("bw")}>
                Preto & Branco
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <RotateCw className="w-3.5 h-3.5 mr-1" />Girar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {orig && (
            <Button variant="ghost" onClick={reset}>
              <X className="w-4 h-4 mr-1" />Trocar foto
            </Button>
          )}
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancelar
          </Button>
          {orig && (
            <Button onClick={confirmar} disabled={processing} className="bg-gradient-primary">
              <Check className="w-4 h-4 mr-1" />{processing ? "Processando…" : "Anexar à despesa"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline de processamento (Canvas)
// ─────────────────────────────────────────────────────────────────────────────
function drawPreview(canvas: HTMLCanvasElement, img: HTMLImageElement, mode: Mode, rotation: number) {
  const maxDim = 1600; // limita a 1600px maior lado
  let w = img.naturalWidth, h = img.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);

  // Aplica rotação
  const swap = rotation === 90 || rotation === 270;
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  if (mode === "color") return;

  // Aplica filtro
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (mode === "magic") aplicarMagic(data);
  else if (mode === "bw") aplicarBW(data);
  ctx.putImageData(data, 0, 0);
}

/** Auto: brilho + contraste + nitidez para parecer scan */
function aplicarMagic(img: ImageData) {
  const d = img.data;
  // 1ª passada: histograma pra encontrar min/max
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  // ignora bordas extremas pra evitar ruído (5% trim)
  const range = Math.max(1, max - min);
  // Aplica auto-níveis + leve contraste (curva)
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = d[i + c];
      v = ((v - min) / range) * 255;
      // contraste
      v = ((v / 255 - 0.5) * 1.25 + 0.5) * 255;
      // brilho
      v += 8;
      d[i + c] = Math.max(0, Math.min(255, v));
    }
  }
}

/** Preto e branco com threshold adaptativo simples */
function aplicarBW(img: ImageData) {
  const d = img.data;
  // calcula luminância média global como threshold
  let soma = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    soma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    n++;
  }
  const media = soma / n;
  const thr = media * 0.92;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum > thr ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
}
