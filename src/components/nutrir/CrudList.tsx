import { ReactNode, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";

interface Props<T> {
  title: string;
  description?: string;
  data: T[];
  loading: boolean;
  searchKeys?: (keyof T)[];
  renderRow: (row: T) => ReactNode;
  headers: string[];
  onNew?: () => void;
  newLabel?: string;
  emptyText?: string;
  toolbar?: ReactNode;
}

export function CrudList<T extends { id: string }>({
  title, description, data, loading, searchKeys, renderRow, headers, onNew, newLabel = "Novo", emptyText = "Nenhum registro", toolbar,
}: Props<T>) {
  const [q, setQ] = useState("");
  const filtered = q && searchKeys
    ? data.filter(r => searchKeys.some(k => String((r as any)[k] ?? "").toLowerCase().includes(q.toLowerCase())))
    : data;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {toolbar}
            {onNew && <Button onClick={onNew}><Plus className="w-4 h-4 mr-1" />{newLabel}</Button>}
          </>
        }
      />
      <div className="p-4 md:p-6 space-y-4">
        {searchKeys && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className="pl-9" />
          </div>
        )}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {headers.map(h => <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground">{emptyText}</td></tr>
                ) : (
                  filtered.map(r => <tr key={r.id} className="border-b hover:bg-muted/30">{renderRow(r)}</tr>)
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
