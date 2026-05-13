// CSV / XLSX export helpers
import * as XLSX from "xlsx";

export type ExportColumn<T> = {
  key: keyof T | string;
  label: string;
  format?: (row: T) => string | number | null | undefined;
};

function formatValue<T>(row: T, col: ExportColumn<T>): string | number {
  const raw = col.format ? col.format(row) : (row as any)[col.key];
  if (raw == null) return "";
  if (raw instanceof Date) return raw.toISOString();
  return raw as any;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCSV<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const head = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const body = rows
    .map(r =>
      columns
        .map(c => {
          const v = formatValue(r, c);
          const s = String(v ?? "");
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  const csv = "\uFEFF" + head + "\n" + body; // BOM para Excel pt-BR
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function exportXLSX<T>(rows: T[], columns: ExportColumn<T>[], filename: string, sheetName = "Dados") {
  const data = rows.map(r => {
    const o: Record<string, any> = {};
    columns.forEach(c => { o[c.label] = formatValue(r, c); });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.label) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}

export function exportXLSXMultiSheet(
  sheets: { name: string; rows: any[]; columns: ExportColumn<any>[] }[],
  filename: string,
) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const data = s.rows.map(r => {
      const o: Record<string, any> = {};
      s.columns.forEach(c => { o[c.label] = formatValue(r, c); });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: s.columns.map(c => c.label) });
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}

const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString("pt-BR") : "";
const fmtDT = (v: string | null | undefined) => v ? new Date(v).toLocaleString("pt-BR") : "";

// Pre-built column sets for common entities
export const SOIL_COLUMNS: ExportColumn<any>[] = [
  { key: "collected_at", label: "Data coleta", format: r => fmtDate(r.collected_at) },
  { key: "crop", label: "Cultura" },
  { key: "ph", label: "pH" },
  { key: "organic_matter", label: "M.O." },
  { key: "phosphorus", label: "P" },
  { key: "potassium", label: "K" },
  { key: "calcium", label: "Ca" },
  { key: "magnesium", label: "Mg" },
  { key: "sulfur", label: "S" },
  { key: "nitrogen", label: "N" },
  { key: "cec", label: "CTC" },
  { key: "field_name", label: "Talhão" },
  { key: "client_name", label: "Cliente" },
];

export const LEAF_COLUMNS: ExportColumn<any>[] = [
  { key: "collected_at", label: "Data coleta", format: r => fmtDate(r.collected_at) },
  { key: "crop", label: "Cultura" },
  { key: "n", label: "N" }, { key: "p", label: "P" }, { key: "k", label: "K" },
  { key: "ca", label: "Ca" }, { key: "mg", label: "Mg" }, { key: "s", label: "S" },
  { key: "b", label: "B" }, { key: "cu", label: "Cu" }, { key: "fe", label: "Fe" },
  { key: "mn", label: "Mn" }, { key: "zn", label: "Zn" },
  { key: "field_name", label: "Talhão" },
  { key: "client_name", label: "Cliente" },
];

export const FIELDS_COLUMNS: ExportColumn<any>[] = [
  { key: "name", label: "Nome" },
  { key: "cultura", label: "Cultura" },
  { key: "hectares", label: "Hectares" },
  { key: "centroid_lat", label: "Latitude" },
  { key: "centroid_lng", label: "Longitude" },
  { key: "client_name", label: "Cliente" },
  { key: "created_at", label: "Criado em", format: r => fmtDT(r.created_at) },
];

export const POINTS_COLUMNS: ExportColumn<any>[] = [
  { key: "created_at", label: "Data", format: r => fmtDT(r.created_at) },
  { key: "kind", label: "Tipo" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "altitude_m", label: "Altitude (m)" },
  { key: "accuracy_m", label: "Precisão (m)" },
  { key: "field_name", label: "Talhão" },
  { key: "client_name", label: "Cliente" },
  { key: "notes", label: "Notas" },
];

export const RECS_COLUMNS: ExportColumn<any>[] = [
  { key: "created_at", label: "Data", format: r => fmtDT(r.created_at) },
  { key: "model", label: "Modelo" },
  { key: "prompt", label: "Pergunta" },
  { key: "response", label: "Recomendação" },
  { key: "field_name", label: "Talhão" },
];
