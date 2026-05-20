import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingDown, Leaf, FlaskConical, Sprout, Droplets, BarChart3 } from "lucide-react";
import { fmtBRL } from "@/lib/nutrir/format";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtKg = (n: number) => `${fmt2(n)} kg`;
const fmtL = (n: number) => `${fmt2(n)} L`;

// ─── constantes agronômicas ───────────────────────────────────────────────────
const UREIA_N_PCT        = 0.46;   // 46% N ureia convencional
const N180_N_KG_PER_L   = 0.180;  // 180 g N por litro de N180 = 0,180 kg N/L
const UREIA_KG_PER_L_N180 = 0.400; // receita: 400 g ureia por litro de N180
const ACIDO_BORICO_B_PCT = 0.174;  // ácido bórico: 17,4% B
const BORAX_B_PCT        = 0.113;  // bórax: 11,3% B
const BOR_COMPLEX_B_PCT  = 0.10;   // boro complexado líquido: ~10% B
const N32_N_PCT          = 0.32;   // UAN N32: 32% N (foliar)
const NITROPLUS_N_PCT    = 0.30;   // NitroPlus: ~30% N

// ─── campos de resultado estilizados ─────────────────────────────────────────
function Resultado({ label, valor, destaque = false, cor = "default" }: {
  label: string; valor: string; destaque?: boolean; cor?: "default" | "green" | "amber" | "red";
}) {
  const bg = cor === "green" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
           : cor === "amber" ? "bg-amber-50 border-amber-200 text-amber-800"
           : cor === "red"   ? "bg-red-50 border-red-200 text-red-800"
           : "bg-muted/40 border-muted text-foreground";
  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-60">{label}</div>
      <div className={`${destaque ? "text-xl" : "text-base"} font-bold font-mono mt-0.5`}>{valor}</div>
    </div>
  );
}

function Separador({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{titulo}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── subcomponentes de entrada ────────────────────────────────────────────────
function CampoKg({ label, value, onChange, sufixo = "kg N/ha", min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; sufixo?: string; min?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number" min={min} step="0.1" inputMode="decimal"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="pr-20"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground whitespace-nowrap">{sufixo}</span>
      </div>
    </div>
  );
}

function CampoPreco({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
        <Input
          type="number" min={0} step="0.01" inputMode="decimal"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="pl-8 pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/kg</span>
      </div>
    </div>
  );
}

// ─── calculadora N180 ─────────────────────────────────────────────────────────
const ESTAGIOS_N180 = ["Sulco", "V2", "V4", "V6", "V8", "R1"] as const;
type EstagioN180 = typeof ESTAGIOS_N180[number];
const PARCELAS_DEFAULT: Record<EstagioN180, number> = { Sulco: 30, V2: 0, V4: 20, V6: 20, V8: 0, R1: 30 };

// Receita de cada variante de N180:
// fator = redução agronômica de dose relativa à ureia convencional
// doseAditivoL = litros do aditivo por litro de N180 produzido
// defaultPrecoAditivo = preço sugerido para o aditivo (R$/L)
const OPCOES_N180 = {
  n180:     { nome: "N180 Padrão",   fator: 0.40, doseAditivoL: 0,       defaultPrecoAditivo: 0,
              aditivo: null,
              obs: "Ureia complexada — 60% menos perdas por volatilização.",
              micronObs: null },
  tsh:      { nome: "N180 TSH",      fator: 0.35, doseAditivoL: 0.00810, defaultPrecoAditivo: 16.5,
              aditivo: "TSH",
              obs: "TSH complexado — aplique via Micron no sulco de plantio.",
              micronObs: "TSH aplica via Micron no sulco. Concentrar 100% no sulco é indicado." },
  lifegrow: { nome: "N180 Life Grow",fator: 0.38, doseAditivoL: 0.00875, defaultPrecoAditivo: 25.0,
              aditivo: "Life Grow",
              obs: "Com bioestimulante — estimula absorção e crescimento radicular.",
              micronObs: "Life Grow: preferir aplicações via Micron em V4–V6 para melhor absorção." },
  leg:      { nome: "N180 LEG",      fator: 0.42, doseAditivoL: 0.00900, defaultPrecoAditivo: 22.0,
              aditivo: "LEG",
              obs: "Formulação para leguminosas — compatível com inoculante.",
              micronObs: "LEG: compatível com inoculante. Aplicar no sulco ou via Micron em V2." },
} as const;
type OpcaoN180 = keyof typeof OPCOES_N180;

function CalcN180() {
  const [doseN, setDoseN] = useState(30);
  const [area, setArea] = useState(1);
  const [precoUreia, setPrecoUreia] = useState(2.20);   // R$/kg
  const [opcao, setOpcao] = useState<OpcaoN180>("n180");
  const [precoAditivo, setPrecoAditivo] = useState(16.5); // R$/L (muda conforme opção)

  // Micron
  const [possuiMicron, setPossuiMicron] = useState(false);
  const [vazao, setVazao] = useState(30); // L/ha

  // Parcelamento por estágio
  const [parcelar, setParcelar] = useState(false);
  const [parcelas, setParcelas] = useState<Record<EstagioN180, number>>({ ...PARCELAS_DEFAULT });

  const totalParcelas = ESTAGIOS_N180.reduce((s, e) => s + (parcelas[e] || 0), 0);
  const parcOk = totalParcelas === 100;

  const opt = OPCOES_N180[opcao];

  // ── Cálculos ──────────────────────────────────────────────────
  // Ureia convencional
  const ureiaKgHa = doseN / UREIA_N_PCT;              // kg ureia/ha
  const custoUreiaHa = ureiaKgHa * precoUreia;        // R$/ha

  // N180: quantidade em litros (receita: 400g ureia + aditivo + água = 1L N180 com 180g N)
  const doseNReduzida = doseN * opt.fator;             // kg N/ha com eficiência aumentada
  const n180LHa = doseNReduzida / N180_N_KG_PER_L;    // L N180/ha necessários

  // Preço do N180 auto-calculado (R$/L):
  // custo ureia/L N180 + custo aditivo/L N180
  const precoN180Calc = (UREIA_KG_PER_L_N180 * precoUreia) + (opt.doseAditivoL * precoAditivo);
  const custoN180Ha = n180LHa * precoN180Calc;        // R$/ha

  const economiaHa = custoUreiaHa - custoN180Ha;

  // Micron: L de N180 por 1.000L de calda
  const lPor1000L = possuiMicron && vazao > 0 ? (n180LHa / vazao) * 1000 : null;

  // Parcelamento
  const parcResultados = ESTAGIOS_N180.map((e) => {
    const lHa = n180LHa * ((parcelas[e] || 0) / 100);
    return {
      estagio: e,
      pct: parcelas[e] || 0,
      lHa,
      lTotal: lHa * area,
      lPor1000L: possuiMicron && vazao > 0 ? (lHa / vazao) * 1000 : null,
    };
  });

  // Atualiza preço do aditivo quando troca de opção
  const trocarOpcao = (k: OpcaoN180) => {
    setOpcao(k);
    setPrecoAditivo(OPCOES_N180[k].defaultPrecoAditivo);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>N180 — Ureia Complexada.</strong> Receita: 400 g ureia + aditivo + água = 1 L N180 (180 g N/L). Preço calculado automaticamente.
      </div>

      {/* Linha de produto */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(OPCOES_N180) as OpcaoN180[]).map((k) => {
          const v = OPCOES_N180[k];
          return (
            <button key={k} onClick={() => trocarOpcao(k)}
              className={`rounded-lg border p-2.5 text-left transition ${opcao === k ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              <div className="text-xs font-bold">{v.nome}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{Math.round((1 - v.fator) * 100)}% menos dose</div>
            </button>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground italic">{opt.obs}</div>

      {/* Entradas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <CampoKg label="Dose de N desejada" value={doseN} onChange={setDoseN} sufixo="kg N/ha" />
        <CampoKg label="Área" value={area} onChange={setArea} sufixo="ha" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CampoPreco label="Preço ureia (R$/kg)" value={precoUreia} onChange={setPrecoUreia} />
        {opt.aditivo && (
          <div className="space-y-1.5">
            <Label className="text-xs">Preço {opt.aditivo} (R$/L)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input type="number" min={0} step="0.01"
                value={precoAditivo || ""}
                onFocus={e => e.target.select()}
                onChange={e => setPrecoAditivo(parseFloat(e.target.value) || 0)}
                className="pl-8 pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/L</span>
            </div>
          </div>
        )}
      </div>

      {/* Preço N180 auto-calculado */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 opacity-70">Preço N180 calculado automaticamente</div>
        <div className="text-2xl font-bold font-mono text-emerald-800 mt-0.5">{fmtBRL(precoN180Calc)}/L</div>
        <div className="text-xs text-emerald-700 mt-1">
          {UREIA_KG_PER_L_N180} kg ureia × {fmtBRL(precoUreia)}/kg
          {opt.aditivo && ` + ${opt.doseAditivoL * 1000} mL ${opt.aditivo} × ${fmtBRL(precoAditivo)}/L`}
        </div>
      </div>

      {/* Toggle Micron */}
      <div className="border rounded-lg p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={possuiMicron} onChange={(e) => setPossuiMicron(e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">Possui Micron?</span>
        </label>
        {possuiMicron && (
          <div className="space-y-3">
            <CampoKg label="Vazão do Micron" value={vazao} onChange={setVazao} sufixo="L/ha" />
            {opt.micronObs && (
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">{opt.micronObs}</div>
            )}
            {lPor1000L !== null && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 opacity-70">Fórmula para 1.000 L de calda no Micron</div>
                <div className="text-2xl font-bold font-mono text-emerald-800 mt-0.5">{fmt2(lPor1000L)} L N180 / 1.000 L</div>
                <div className="text-xs text-emerald-700 mt-1">Vazão {fmt1(vazao)} L/ha → entrega {fmt2(n180LHa)} L N180/ha</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toggle parcelamento */}
      <div className="border rounded-lg p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={parcelar} onChange={(e) => setParcelar(e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">Parcelar dose por estágio?</span>
        </label>
        {parcelar && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Distribua 100% da dose entre os estágios:</div>
            <div className="grid grid-cols-3 gap-2">
              {ESTAGIOS_N180.map((e) => (
                <div key={e} className="space-y-1">
                  <Label className="text-xs font-semibold">{e}</Label>
                  <div className="relative">
                    <Input type="number" min={0} max={100} step={5}
                      value={parcelas[e] || ""}
                      onChange={(ev) => setParcelas((p) => ({ ...p, [e]: Number(ev.target.value) || 0 }))}
                      className="pr-7 h-8 text-xs" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={`text-xs font-semibold ${parcOk ? "text-emerald-700" : "text-red-600"}`}>
              Total: {totalParcelas}% {parcOk ? "✓" : `— faltam ${100 - totalParcelas}%`}
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Estágio</th>
                    <th className="text-right px-3 py-2">%</th>
                    <th className="text-right px-3 py-2">L N180/ha</th>
                    <th className="text-right px-3 py-2">L total</th>
                    {possuiMicron && <th className="text-right px-3 py-2">L/1.000L Micron</th>}
                  </tr>
                </thead>
                <tbody>
                  {parcResultados.filter((r) => r.pct > 0).map((r) => (
                    <tr key={r.estagio} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{r.estagio}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.pct}%</td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-700">{fmt2(r.lHa)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt2(r.lTotal)}</td>
                      {possuiMicron && (
                        <td className="px-3 py-1.5 text-right font-mono text-blue-700">
                          {r.lPor1000L != null ? fmt2(r.lPor1000L) : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Separador titulo="Resultado por hectare" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Resultado label="Ureia convencional" valor={fmtKg(ureiaKgHa)} />
        <Resultado label={`${opt.nome} (L/ha)`} valor={`${fmt2(n180LHa)} L`} cor="green" destaque />
        <Resultado label="Custo Ureia/ha" valor={fmtBRL(custoUreiaHa)} cor="red" />
        <Resultado label={`Custo ${opt.nome}/ha`} valor={fmtBRL(custoN180Ha)} cor="green" />
      </div>

      <Separador titulo={`Custo total (${fmt2(area)} ha)`} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Resultado label="Custo ureia total" valor={fmtBRL(custoUreiaHa * area)} cor="red" />
        <Resultado label={`Custo ${opt.nome} total`} valor={fmtBRL(custoN180Ha * area)} cor="green" />
        <Resultado label="Economia financeira" valor={fmtBRL(economiaHa * area)} cor={economiaHa >= 0 ? "green" : "red"} destaque />
      </div>
    </div>
  );
}

// ─── calculadora N180+B ───────────────────────────────────────────────────────
function CalcN180B() {
  const [doseN, setDoseN] = useState(30);
  const [doseB, setDoseB] = useState(1.5);
  const [area, setArea] = useState(1);
  const [precoUreia, setPrecoUreia] = useState(2.20);
  const [fonteB, setFonteB] = useState<"acido_borico" | "borax" | "complexado">("acido_borico");
  const [precoBoro, setPrecoBoro] = useState(6.00);

  const FONTE_B: Record<string, { nome: string; pct: number; sufixo: string }> = {
    acido_borico: { nome: "Ácido Bórico (17,4% B)", pct: ACIDO_BORICO_B_PCT, sufixo: "kg/ha" },
    borax:        { nome: "Bórax (11,3% B)",         pct: BORAX_B_PCT,         sufixo: "kg/ha" },
    complexado:   { nome: "Boro Complexado (10% B)", pct: BOR_COMPLEX_B_PCT,   sufixo: "L/ha" },
  };

  const opt = OPCOES_N180["n180"]; // N180+B usa o padrão (sem aditivo extra)
  const fb = FONTE_B[fonteB];
  const ureiaKgHa = doseN / UREIA_N_PCT;
  const doseNReduzida = doseN * opt.fator;
  const n180LHa = doseNReduzida / N180_N_KG_PER_L;
  const precoN180Calc = UREIA_KG_PER_L_N180 * precoUreia; // padrão, sem aditivo
  const boroNecessario = doseB / fb.pct;
  const custoUreiaHa = ureiaKgHa * precoUreia + boroNecessario * precoBoro;
  const custoN180BHa = n180LHa * precoN180Calc + boroNecessario * precoBoro;
  const economia = (custoUreiaHa - custoN180BHa) * area;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>N180+B — Nitrogênio Complexado + Boro.</strong> Combina a eficiência da ureia complexada (180 g N/L) com boro para culturas com alta demanda.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <CampoKg label="Dose de N desejada" value={doseN} onChange={setDoseN} sufixo="kg N/ha" />
        <CampoKg label="Dose de B desejada" value={doseB} onChange={setDoseB} sufixo="kg B/ha" />
        <CampoKg label="Área" value={area} onChange={setArea} sufixo="ha" />
      </div>

      <div>
        <Label className="text-xs">Fonte de boro</Label>
        <div className="grid grid-cols-3 gap-2 mt-1.5">
          {Object.entries(FONTE_B).map(([k, v]) => (
            <button key={k} onClick={() => setFonteB(k as any)}
              className={`rounded-lg border p-2 text-left text-xs transition ${fonteB === k ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              {v.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CampoPreco label="Preço ureia (R$/kg)" value={precoUreia} onChange={setPrecoUreia} />
        <div className="space-y-1.5">
          <Label className="text-xs">Preço boro (R$/{fb.sufixo.split("/")[1]})</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input type="number" min={0} step="0.01" value={precoBoro || ""}
              onFocus={e => e.target.select()}
              onChange={(e) => setPrecoBoro(parseFloat(e.target.value) || 0)}
              className="pl-8 pr-14" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/{fb.sufixo.split("/")[1]}</span>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 opacity-70">N180 calculado (padrão, sem aditivo)</div>
        <div className="text-lg font-bold font-mono text-emerald-800 mt-0.5">{fmt2(n180LHa)} L/ha · {fmtBRL(precoN180Calc)}/L</div>
      </div>

      <Separador titulo="Resultado por hectare" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Resultado label="Ureia convencional" valor={fmtKg(ureiaKgHa)} />
        <Resultado label="N180 necessário" valor={`${fmt2(n180LHa)} L`} cor="green" destaque />
        <Resultado label={`${fb.nome.split(" ")[0]} necessário`} valor={fonteB === "complexado" ? fmtL(boroNecessario) : fmtKg(boroNecessario)} cor="amber" />
        <Resultado label="Boro fornecido" valor={`${fmt2(doseB)} kg B/ha`} />
      </div>

      <Separador titulo={`Custo total (${fmt2(area)} ha)`} />
      <div className="grid grid-cols-3 gap-3">
        <Resultado label="Custo convencional (N+B)" valor={fmtBRL(custoUreia)} cor="red" />
        <Resultado label="Custo N180+B" valor={fmtBRL(custoN180B)} cor="green" />
        <Resultado label="Economia" valor={fmtBRL(economia)} cor={economia >= 0 ? "green" : "red"} destaque />
      </div>
    </div>
  );
}

// ─── calculadora N32 (foliar) ─────────────────────────────────────────────────
function CalcN32() {
  const [doseN, setDoseN] = useState(3);
  const [area, setArea] = useState(1);
  const [naplicacoes, setNaplicacoes] = useState(2);
  const [precoN32, setPrecoN32] = useState(3.80);
  const [precoUreia, setPrecoUreia] = useState(2.20);
  const [comB, setComB] = useState(false);
  const [doseB, setDoseB] = useState(0.5);
  const [precoBorax, setPrecoBorax] = useState(5.50);

  const n32PorHa = doseN / N32_N_PCT;   // L/ha por aplicação
  const ureiaPorHa = doseN / UREIA_N_PCT;
  const custoN32Total = n32PorHa * precoN32 * naplicacoes * area;
  const custoUreiaTotal = ureiaPorHa * precoUreia * naplicacoes * area;
  const boraxNecessario = comB ? doseB / BORAX_B_PCT : 0;
  const custoBorax = boraxNecessario * precoBorax * naplicacoes * area;
  const custoTotal = custoN32Total + custoBorax;
  const economia = custoUreiaTotal - custoTotal;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>N32 — Nitrogênio Foliar (32% N).</strong> Solução nitrogenada UAN para aplicação foliar. Alta taxa de absorção via foliar para coberturas em estágios críticos.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CampoKg label="Dose N por aplicação" value={doseN} onChange={setDoseN} sufixo="kg N/ha" />
        <CampoKg label="Nº de aplicações" value={naplicacoes} onChange={setNaplicacoes} sufixo="aplic." />
        <CampoKg label="Área" value={area} onChange={setArea} sufixo="ha" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Preço N32 (R$/L)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input type="number" min={0} step="0.01" value={precoN32 || ""}
              onChange={(e) => setPrecoN32(parseFloat(e.target.value) || 0)}
              className="pl-8 pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/L</span>
          </div>
        </div>
        <CampoPreco label="Preço ureia foliar (comparativo)" value={precoUreia} onChange={setPrecoUreia} />
      </div>

      {/* N32+B toggle */}
      <div className="border rounded-lg p-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={comB} onChange={(e) => setComB(e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">Adicionar boro (N32+B)</span>
        </label>
        {comB && (
          <div className="grid grid-cols-2 gap-3">
            <CampoKg label="Dose B por aplicação" value={doseB} onChange={setDoseB} sufixo="kg B/ha" />
            <div className="space-y-1.5">
              <Label className="text-xs">Preço Borax (R$/kg)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input type="number" min={0} step="0.01" value={precoBorax || ""}
                  onChange={(e) => setPrecoBorax(parseFloat(e.target.value) || 0)}
                  className="pl-8 pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/kg</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separador titulo="Resultado por aplicação / ha" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Resultado label="N32 necessário" valor={fmtL(n32PorHa)} cor="green" destaque />
        <Resultado label="Ureia convencional" valor={fmtKg(ureiaPorHa)} />
        {comB && <Resultado label="Borax necessário" valor={fmtKg(boraxNecessario)} cor="amber" />}
        <Resultado label="Dose de N entregue" valor={`${fmt2(doseN)} kg N/ha`} />
      </div>

      <Separador titulo={`Custo total (${naplicacoes} aplic. × ${fmt2(area)} ha)`} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Resultado label="Custo N32 total" valor={fmtBRL(custoN32Total)} cor="green" />
        {comB && <Resultado label="Custo boro total" valor={fmtBRL(custoBorax)} cor="amber" />}
        <Resultado label="Custo total" valor={fmtBRL(custoTotal)} cor="green" destaque />
        <Resultado label="vs. ureia foliar" valor={fmtBRL(economia)} cor={economia >= 0 ? "green" : "red"} />
      </div>
    </div>
  );
}

// ─── calculadora NitroPlus = N180 + Foliar Completa ──────────────────────────
function CalcNitroPlus() {
  const [doseN, setDoseN] = useState(20);
  const [area, setArea] = useState(1);
  const [precoUreia, setPrecoUreia] = useState(2.20);
  const [precoAditivo, setPrecoAditivo] = useState(25.0); // Life Grow R$/L
  // Foliar completo
  const [doseFoliar, setDoseFoliar] = useState(1.5);   // L/ha
  const [precoFoliar, setPrecoFoliar] = useState(18.0); // R$/L

  const opt = OPCOES_N180["lifegrow"]; // NitroPlus usa Life Grow
  const doseNReduzida = doseN * opt.fator;
  const n180LHa = doseNReduzida / N180_N_KG_PER_L;
  const precoN180Calc = (UREIA_KG_PER_L_N180 * precoUreia) + (opt.doseAditivoL * precoAditivo);
  const custoN180Ha = n180LHa * precoN180Calc;
  const custoFoliarHa = doseFoliar * precoFoliar;
  const custoNitroPlusHa = custoN180Ha + custoFoliarHa;

  const ureiaConvKgHa = doseN / UREIA_N_PCT;
  const custoUreiaHa = ureiaConvKgHa * precoUreia;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>NitroPlus = N180 (Life Grow) + Foliar Completa.</strong> Combina o N180 com Life Grow para nutrição nitrogenada + pacote foliar multinutriente numa só aplicação.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CampoKg label="Dose de N desejada" value={doseN} onChange={setDoseN} sufixo="kg N/ha" />
        <CampoKg label="Área" value={area} onChange={setArea} sufixo="ha" />
      </div>

      <Separador titulo="N180 Life Grow" />
      <div className="grid grid-cols-2 gap-3">
        <CampoPreco label="Preço ureia (R$/kg)" value={precoUreia} onChange={setPrecoUreia} />
        <div className="space-y-1.5">
          <Label className="text-xs">Preço Life Grow (R$/L)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input type="number" step="0.01" value={precoAditivo || ""}
              onFocus={e => e.target.select()}
              onChange={e => setPrecoAditivo(parseFloat(e.target.value) || 0)}
              className="pl-8 pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/L</span>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 opacity-70">N180 calculado</div>
        <div className="flex gap-4 mt-0.5">
          <div><span className="text-lg font-bold font-mono text-emerald-800">{fmt2(n180LHa)} L/ha</span><span className="text-xs text-emerald-700 ml-2">{fmtBRL(precoN180Calc)}/L</span></div>
        </div>
      </div>

      <Separador titulo="Foliar Completo" />
      <div className="grid grid-cols-2 gap-3">
        <CampoKg label="Dose foliar" value={doseFoliar} onChange={setDoseFoliar} sufixo="L/ha" />
        <div className="space-y-1.5">
          <Label className="text-xs">Preço foliar completo (R$/L)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input type="number" step="0.01" value={precoFoliar || ""}
              onFocus={e => e.target.select()}
              onChange={e => setPrecoFoliar(parseFloat(e.target.value) || 0)}
              className="pl-8 pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/L</span>
          </div>
        </div>
      </div>

      <Separador titulo={`Resultado (${fmt2(area)} ha)`} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Resultado label="Custo N180/ha" valor={fmtBRL(custoN180Ha)} cor="green" />
        <Resultado label="Custo Foliar/ha" valor={fmtBRL(custoFoliarHa)} cor="amber" />
        <Resultado label="NitroPlus total/ha" valor={fmtBRL(custoNitroPlusHa)} cor="green" destaque />
        <Resultado label="Ureia conv. total" valor={fmtBRL(custoUreiaHa * area)} cor="red" />
        <Resultado label="NitroPlus total" valor={fmtBRL(custoNitroPlusHa * area)} cor="green" />
        <Resultado label={custoUreiaHa > custoNitroPlusHa ? "Economia" : "Custo adicional"} valor={fmtBRL(Math.abs((custoUreiaHa - custoNitroPlusHa) * area))} cor={custoUreiaHa >= custoNitroPlusHa ? "green" : "amber"} destaque />
      </div>
    </div>
  );
}

// ─── Adubação Foliar Completa ─────────────────────────────────────────────────
function CalcFoliarCompleta() {
  const [area, setArea] = useState(1);
  const [doseN, setDoseN] = useState(2);
  const [doseP, setDoseP] = useState(1);
  const [doseK, setDoseK] = useState(2);
  const [doseB, setDoseB] = useState(0.5);
  const [doseZn, setDoseZn] = useState(0.3);
  const [doseMn, setDoseMn] = useState(0.2);
  const [precoFoliar, setPrecoFoliar] = useState(18.00);

  // Referência: um foliar completo entrega via dose única
  // Composição típica de foliar completo Nutrir: N 5%, P 3%, K 5%, B 0.5%, Zn 0.3%, Mn 0.3%
  const COMP = { N: 0.05, P: 0.03, K: 0.05, B: 0.005, Zn: 0.003, Mn: 0.003 };

  const doseFoliarN = doseN / COMP.N;
  const doseFoliarP = doseP / COMP.P;
  const doseFoliarK = doseK / COMP.K;
  const doseFoliarB = doseB / COMP.B;
  const doseFoliarZn = doseZn / COMP.Zn;
  const doseFoliarMn = doseMn / COMP.Mn;

  // Dose recomendada = maior entre os nutrientes limitantes (produto que fornece todos)
  const doseRecomendada = Math.max(doseFoliarN, doseFoliarP, doseFoliarK, doseFoliarB, doseFoliarZn, doseFoliarMn);
  const custoTotal = doseRecomendada * precoFoliar * area;

  const nutrientes = [
    { nome: "N", dose: doseN, setDose: setDoseN, entregue: doseRecomendada * COMP.N },
    { nome: "P₂O₅", dose: doseP, setDose: setDoseP, entregue: doseRecomendada * COMP.P },
    { nome: "K₂O", dose: doseK, setDose: setDoseK, entregue: doseRecomendada * COMP.K },
    { nome: "B", dose: doseB, setDose: setDoseB, entregue: doseRecomendada * COMP.B },
    { nome: "Zn", dose: doseZn, setDose: setDoseZn, entregue: doseRecomendada * COMP.Zn },
    { nome: "Mn", dose: doseMn, setDose: setDoseMn, entregue: doseRecomendada * COMP.Mn },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>Adubação Foliar Completa.</strong> Calculadora multinutriente. Informe a demanda de cada elemento e o sistema calcula a dose do foliar completo necessária para atender o mais exigente.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {nutrientes.map(n => (
          <CampoKg key={n.nome} label={`Dose ${n.nome} desejada`} value={n.dose} onChange={n.setDose} sufixo="kg/ha" />
        ))}
        <CampoKg label="Área" value={area} onChange={setArea} sufixo="ha" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Preço do foliar completo (R$/L)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
          <Input type="number" min={0} step="0.01" value={precoFoliar || ""}
            onChange={(e) => setPrecoFoliar(parseFloat(e.target.value) || 0)}
            className="pl-8 pr-8" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/L</span>
        </div>
      </div>

      <Separador titulo="Resultado" />
      <Resultado label="Dose de foliar completo" valor={fmtL(doseRecomendada)} cor="green" destaque />

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2">Nutriente</th>
              <th className="text-right px-3 py-2">Desejado</th>
              <th className="text-right px-3 py-2">Entregue</th>
              <th className="text-right px-3 py-2">%</th>
            </tr>
          </thead>
          <tbody>
            {nutrientes.map(n => {
              const pct = n.dose > 0 ? (n.entregue / n.dose) * 100 : 0;
              return (
                <tr key={n.nome} className="border-t">
                  <td className="px-3 py-1.5 font-medium">{n.nome}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmt2(n.dose)} kg</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmt2(n.entregue)} kg</td>
                  <td className={`px-3 py-1.5 text-right font-mono ${pct >= 100 ? "text-emerald-700" : "text-amber-600"}`}>
                    {fmt1(pct)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Resultado label={`Custo total (${fmt2(area)} ha)`} valor={fmtBRL(custoTotal)} cor="green" destaque />
    </div>
  );
}

// ─── NPK Solo ─────────────────────────────────────────────────────────────────
function CalcNPKSolo() {
  const [demandaN, setDemandaN] = useState(60);
  const [demandaP, setDemandaP] = useState(80);
  const [demandaK, setDemandaK] = useState(80);
  const [area, setArea] = useState(1);
  const [precoUreia, setPrecoUreia] = useState(2.20);
  const [precoMap, setPrecoMap] = useState(4.80);
  const [preco_kcl, setPrecoKcl] = useState(2.00);
  const [precoNPKComplexo, setPrecoNPKComplexo] = useState(5.50);
  const [gradNPK, setGradNPK] = useState("04-14-08"); // N-P-K do complexo

  const parseNPK = (s: string) => {
    const parts = s.split("-").map(Number);
    return { n: (parts[0] ?? 0) / 100, p: (parts[1] ?? 0) / 100, k: (parts[2] ?? 0) / 100 };
  };
  const npk = parseNPK(gradNPK);

  // Convencional
  const ureiaNecessaria = demandaN / UREIA_N_PCT;
  const mapNecessario = demandaP / 0.48;   // MAP 48% P2O5
  const kclNecessario = demandaK / 0.60;   // KCl 60% K2O
  const custoConv = (ureiaNecessaria * precoUreia + mapNecessario * precoMap + kclNecessario * preco_kcl) * area;

  // Complexo Nutrir
  const dosePorN = npk.n > 0 ? demandaN / npk.n : 0;
  const dosePorP = npk.p > 0 ? demandaP / npk.p : 0;
  const dosePorK = npk.k > 0 ? demandaK / npk.k : 0;
  const doseComplexo = Math.max(dosePorN, dosePorP, dosePorK);
  const custoComplexo = doseComplexo * precoNPKComplexo * area;
  const economia = custoConv - custoComplexo;

  const nutrEntregues = {
    n: doseComplexo * npk.n,
    p: doseComplexo * npk.p,
    k: doseComplexo * npk.k,
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>NPK Solo — Comparativo de custo.</strong> Compare adubação convencional (ureia + MAP + KCl) versus formulado complexo Nutrir, calculando dose e custo.
      </div>

      <div className="grid grid-cols-3 gap-3">
        <CampoKg label="Demanda N" value={demandaN} onChange={setDemandaN} sufixo="kg N/ha" />
        <CampoKg label="Demanda P₂O₅" value={demandaP} onChange={setDemandaP} sufixo="kg P₂O₅/ha" />
        <CampoKg label="Demanda K₂O" value={demandaK} onChange={setDemandaK} sufixo="kg K₂O/ha" />
      </div>
      <CampoKg label="Área" value={area} onChange={setArea} sufixo="ha" />

      <Separador titulo="Formulação convencional" />
      <div className="grid grid-cols-3 gap-3">
        <CampoPreco label="Ureia (46% N)" value={precoUreia} onChange={setPrecoUreia} />
        <CampoPreco label="MAP (48% P₂O₅)" value={precoMap} onChange={setPrecoMap} />
        <CampoPreco label="KCl (60% K₂O)" value={preco_kcl} onChange={setPrecoKcl} />
      </div>

      <Separador titulo="Formulado complexo Nutrir" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Gradação NPK (ex.: 04-14-08)</Label>
          <Input value={gradNPK} onChange={(e) => setGradNPK(e.target.value)} placeholder="N-P-K" className="font-mono" />
        </div>
        <CampoPreco label="Preço complexo Nutrir" value={precoNPKComplexo} onChange={setPrecoNPKComplexo} />
      </div>

      <Separador titulo="Resultado comparativo" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Resultado label="Ureia convencional" valor={fmtKg(ureiaNecessaria)} />
        <Resultado label="MAP" valor={fmtKg(mapNecessario)} />
        <Resultado label="KCl" valor={fmtKg(kclNecessario)} />
        <Resultado label="Custo convencional/ha" valor={fmtBRL(custoConv / area)} cor="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Resultado label="Dose complexo Nutrir" valor={fmtKg(doseComplexo)} cor="green" destaque />
        <Resultado label="N entregue" valor={fmtKg(nutrEntregues.n)} cor={nutrEntregues.n >= demandaN ? "green" : "amber"} />
        <Resultado label="P₂O₅ entregue" valor={fmtKg(nutrEntregues.p)} cor={nutrEntregues.p >= demandaP ? "green" : "amber"} />
        <Resultado label="K₂O entregue" valor={fmtKg(nutrEntregues.k)} cor={nutrEntregues.k >= demandaK ? "green" : "amber"} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Resultado label="Custo convencional" valor={fmtBRL(custoConv)} cor="red" />
        <Resultado label="Custo complexo Nutrir" valor={fmtBRL(custoComplexo)} cor="green" />
        <Resultado label={economia >= 0 ? "Economia" : "Custo adicional"} valor={fmtBRL(Math.abs(economia))} cor={economia >= 0 ? "green" : "amber"} destaque />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function MotorCalculos() {
  const { current } = useOrg();
  const [formulas, setFormulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("nutrir_formula_cabecalho")
        .select("id,nome,codigo,status,updated_at")
        .eq("organization_id", current.id)
        .order("nome");
      setFormulas(data ?? []);
      setLoading(false);
    })();
  }, [current?.id]);

  const ABAS = [
    { id: "n180",          label: "N180",            icon: <FlaskConical className="h-3.5 w-3.5" />,  comp: <CalcN180 /> },
    { id: "n180b",         label: "N180+B",           icon: <FlaskConical className="h-3.5 w-3.5" />,  comp: <CalcN180B /> },
    { id: "n32",           label: "N32 / N32+B",      icon: <Droplets className="h-3.5 w-3.5" />,      comp: <CalcN32 /> },
    { id: "nitroplus",     label: "NitroPlus",        icon: <Sprout className="h-3.5 w-3.5" />,        comp: <CalcNitroPlus /> },
    { id: "foliar",        label: "Foliar Completa",  icon: <Leaf className="h-3.5 w-3.5" />,          comp: <CalcFoliarCompleta /> },
    { id: "npk",           label: "NPK Solo",         icon: <BarChart3 className="h-3.5 w-3.5" />,     comp: <CalcNPKSolo /> },
    { id: "formulas",      label: "Fórmulas BD",      icon: <Calculator className="h-3.5 w-3.5" />,    comp: null },
  ];

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" /> Motor de Cálculos
        </h1>
        <p className="text-muted-foreground text-sm">
          Calculadoras N180, N180+B, N32, NitroPlus, Foliar Completa e NPK Solo com comparativo de custo
        </p>
      </div>

      <Tabs defaultValue="n180">
        <TabsList className="flex-wrap h-auto gap-0.5">
          {ABAS.map(a => (
            <TabsTrigger key={a.id} value={a.id} className="flex items-center gap-1.5 text-xs">
              {a.icon} {a.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {ABAS.map(a => (
          <TabsContent key={a.id} value={a.id} className="mt-4">
            {a.id === "formulas" ? (
              <Card>
                <CardHeader><CardTitle className="text-base">Fórmulas cadastradas no banco</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2">Código</th>
                          <th className="text-left px-4 py-2">Nome</th>
                          <th className="text-left px-4 py-2">Status</th>
                          <th className="text-left px-4 py-2">Atualizada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>
                        ) : formulas.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhuma fórmula importada ainda.</td></tr>
                        ) : formulas.map(f => (
                          <tr key={f.id} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-2 font-mono text-xs">{f.codigo ?? "—"}</td>
                            <td className="px-4 py-2 font-medium">{f.nome}</td>
                            <td className="px-4 py-2">
                              {f.status === "publicada" ? <Badge>Publicada</Badge>
                               : f.status === "arquivada" ? <Badge variant="secondary">Arquivada</Badge>
                               : <Badge variant="outline">Rascunho</Badge>}
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {new Date(f.updated_at).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="p-5">{a.comp}</CardContent></Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
