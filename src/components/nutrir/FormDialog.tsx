import { ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function FormDialog({
  open, onOpenChange, title, children, onSave, saving, saveLabel = "Salvar", maxW = "max-w-lg",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  saveLabel?: string;
  maxW?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={maxW}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">{children}</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando…" : saveLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children, span }: { label: string; children: ReactNode; span?: number }) {
  return (
    <div className={span ? `col-span-${span}` : ""}>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}
