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
const UREIA_N_PCT = 0.46;          // 46% N ureia convencional
const N180_N_PCT = 0.45;           // 45% N N180 complexada
const N180_REDUCAO = 0.40;         // redução de dose: 40% da ureia convencional (60% menos)
const ACIDO_BORICO_B_PCT = 0.174;  // ácido bórico: 17,4% B
const BORAX_B_PCT = 0.113;         // bórax: 11,3% B
const BOR_COMPLEX_B_PCT = 0.10;    // boro complexado líquido: ~10% B
const N32_N_PCT = 0.32;            // UAN N32: 32% N (foliar)
const NITROPLUS_N_PCT = 0.30;      // NitroPlus: ~30% N

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

function CalcN180() {
  const [doseN, setDoseN] = useState(30);
  const [area, setArea] = useState(1);
  const [precoUreia, setPrecoUreia] = useState(2.20);
  const [precoN180, setPrecoN180] = useState(4.50);
  const [opcao, setOpcao] = useState<"n180" | "tsh" | "lifegrow" | "leg">("n180");

  // Micronizador
  const [possuiMicron, setPossuiMicron] = useState(false);
  const [vazao, setVazao] = useState(30); // L/ha

  // Parcelamento por estágio
  const [parcelar, setParcelar] = useState(false);
  const [parcelas, setParcelas] = useState<Record<EstagioN180, number>>({ ...PARCELAS_DEFAULT });

  const totalParcelas = ESTAGIOS_N180.reduce((s, e) => s + (parcelas[e] || 0), 0);
  const parcOk = totalParcelas === 100;

  const FATOR_OPCAO: Record<string, { nome: string; fator: number; obs: string; micronObs?: string }> = {
    n180:     { nome: "N180 Padrão",   fator: 0.40, obs: "Ureia complexada — 60% menos perdas por volatilização" },
    tsh:      { nome: "N180 TSH",      fator: 0.35, obs: "Complexado para tratamento de sementes — 65% de eficiência vs. ureia",
                micronObs: "TSH: aplique via micronizador no sulco de plantio. Concentrar 100% no sulco é indicado." },
    lifegrow: { nome: "N180 LifeGrow", fator: 0.38, obs: "Com bioestimulante — estimula absorção e crescimento radicular",
                micronObs: "LifeGrow: preferir aplicações via foliar (V4–V6) com micronizador para melhor absorção." },
    leg:      { nome: "N180 LEG",      fator: 0.42, obs: "Formulação para leguminosas — compatível com inoculante",
                micronObs: "LEG: compatível com inoculante. Aplicar no sulco ou via micronizador em V2." },
  };

  const opt = FATOR_OPCAO[opcao];
  const ureiaNecessaria = doseN / UREIA_N_PCT;
  const n180Necessario = ureiaNecessaria * opt.fator;
  const economiaDose = ureiaNecessaria - n180Necessario;
  const custoUreia = ureiaNecessaria * precoUreia * area;
  const custoN180 = n180Necessario * precoN180 * area;
  const economiaFinanceira = custoUreia - custoN180;

  // Micron: kg de N180 por 1.000L de calda (na vazão informada)
  const kgPor1000L = possuiMicron && vazao > 0 ? (n180Necessario / vazao) * 1000 : null;

  // Parcelamento: kg N180/ha por estágio
  const parcResultados = ESTAGIOS_N180.map((e) => ({
    estagio: e,
    pct: parcelas[e] || 0,
    kgHa: n180Necessario * ((parcelas[e] || 0) / 100),
    kgTotal: n180Necessario * ((parcelas[e] || 0) / 100) * area,
    kgPor1000L: possuiMicron && vazao > 0
      ? (n180Necessario * ((parcelas[e] || 0) / 100) / vazao) * 1000
      : null,
  }));

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>N180 — Ureia Complexada.</strong> Reduz perdas por volatilização em até 60%. Selecione a linha e configure micronizador e parcelamento:
      </div>

      {/* Linha de produto */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(FATOR_OPCAO).map(([k, v]) => (
          <button key={k} onClick={() => setOpcao(k as any)}
            className={`rounded-lg border p-2.5 text-left transition ${opcao === k ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
            <div className="text-xs font-bold">{v.nome}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{Math.round((1 - v.fator) * 100)}% de redução</div>
          </button>
        ))}
      </div>
      <div className="text-xs text-muted-foreground italic">{opt.obs}</div>

      {/* Entradas básicas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CampoKg label="Dose de N desejada" value={doseN} onChange={setDoseN} sufixo="kg N/ha" />
        <CampoKg label="Área" value={area} onChange={setArea} sufixo="ha" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CampoPreco label="Preço ureia convencional" value={precoUreia} onChange={setPrecoUreia} />
        <CampoPreco label="Preço N180" value={precoN180} onChange={setPrecoN180} />
      </div>

      {/* Toggle micronizador */}
      <div className="border rounded-lg p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={possuiMicron} onChange={(e) => setPossuiMicron(e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">Possui micronizador?</span>
        </label>
        {possuiMicron && (
          <div className="space-y-3">
            <CampoKg label="Vazão do micronizador" value={vazao} onChange={setVazao} sufixo="L/ha" />
            {opt.micronObs && (
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">{opt.micronObs}</div>
            )}
            {kgPor1000L !== null && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 opacity-70">Fórmula para 1.000L de calda</div>
                <div className="text-2xl font-bold font-mono text-emerald-800 mt-0.5">{fmt2(kgPor1000L)} kg N180 / 1.000L</div>
                <div className="text-xs text-emerald-700 mt-1">Na vazão de {fmt1(vazao)} L/ha → entrega {fmt2(n180Necessario)} kg N180/ha</div>
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
                    <Input
                      type="number" min={0} max={100} step={5}
                      value={parcelas[e] || ""}
                      onChange={(ev) => setParcelas((p) => ({ ...p, [e]: Number(ev.target.value) || 0 }))}
                      className="pr-7 h-8 text-xs"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={`text-xs font-semibold ${parcOk ? "text-emerald-700" : "text-red-600"}`}>
              Total: {totalParcelas}% {parcOk ? "✓" : `— faltam ${100 - totalParcelas}%`}
            </div>

            {/* Tabela de parcelamento */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Estágio</th>
                    <th className="text-right px-3 py-2">%</th>
                    <th className="text-right px-3 py-2">kg N180/ha</th>
                    <th className="text-right px-3 py-2">kg N180 total</th>
                    {possuiMicron && <th className="text-right px-3 py-2">kg/1.000L</th>}
                  </tr>
                </thead>
                <tbody>
                  {parcResultados.filter((r) => r.pct > 0).map((r) => (
                    <tr key={r.estagio} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{r.estagio}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.pct}%</td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-700">{fmt2(r.kgHa)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt2(r.kgTotal)}</td>
                      {possuiMicron && (
                        <td className="px-3 py-1.5 text-right font-mono text-blue-700">
                          {r.kgPor1000L != null ? fmt2(r.kgPor1000L) : "—"}
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
        <Resultado label="Ureia convencional" valor={fmtKg(ureiaNecessaria)} />
        <Resultado label={opt.nome} valor={fmtKg(n180Necessario)} cor="green" destaque />
        <Resultado label="Redução de dose" valor={fmtKg(economiaDose)} cor="amber" />
        <Resultado label="% de redução" valor={`${fmt1((1 - opt.fator) * 100)}%`} cor="green" />
      </div>

      <Separador titulo={`Custo total (${fmt2(area)} ha)`} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Resultado label="Custo ureia convencional" valor={fmtBRL(custoUreia)} cor="red" />
        <Resultado label={`Custo ${opt.nome}`} valor={fmtBRL(custoN180)} cor="green" />
        <Resultado label="Economia financeira" valor={fmtBRL(economiaFinanceira)} cor={economiaFinanceira >= 0 ? "green" : "red"} destaque />
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
  const [precoN180, setPrecoN180] = useState(4.50);
  const [fonteB, setFonteB] = useState<"acido_borico" | "borax" | "complexado">("acido_borico");
  const [precoBoro, setPrecoBoro] = useState(6.00);

  const FONTE_B: Record<string, { nome: string; pct: number; sufixo: string }> = {
    acido_borico: { nome: "Ácido Bórico (17,4% B)", pct: ACIDO_BORICO_B_PCT, sufixo: "kg/ha" },
    borax:        { nome: "Bórax (11,3% B)",         pct: BORAX_B_PCT,         sufixo: "kg/ha" },
    complexado:   { nome: "Boro Complexado (10% B)", pct: BOR_COMPLEX_B_PCT,   sufixo: "L/ha" },
  };

  const fb = FONTE_B[fonteB];
  const ureiaNecessaria = doseN / UREIA_N_PCT;
  const n180Necessario = ureiaNecessaria * N180_REDUCAO;
  const boroNecessario = doseB / fb.pct;
  const custoUreia = (ureiaNecessaria * precoUreia + boroNecessario * precoBoro) * area;
  const custoN180B = (n180Necessario * precoN180 + boroNecessario * precoBoro) * area;
  const economia = custoUreia - custoN180B;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>N180+B — Nitrogênio Complexado + Boro.</strong> Combina a eficiência da ureia complexada com a aplicação de boro para culturas com alta demanda (soja, milho, algodão).
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

      <div className="grid grid-cols-3 gap-3">
        <CampoPreco label="Preço ureia convencional" value={precoUreia} onChange={setPrecoUreia} />
        <CampoPreco label="Preço N180" value={precoN180} onChange={setPrecoN180} />
        <div className="space-y-1.5">
          <Label className="text-xs">Preço boro (R$/{fb.sufixo.split("/")[1]})</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input type="number" min={0} step="0.01" value={precoBoro || ""}
              onChange={(e) => setPrecoBoro(parseFloat(e.target.value) || 0)}
              className="pl-8 pr-14" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/{fb.sufixo.split("/")[1]}</span>
          </div>
        </div>
      </div>

      <Separador titulo="Resultado por hectare" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Resultado label="Ureia convencional" valor={fmtKg(ureiaNecessaria)} />
        <Resultado label="N180 necessário" valor={fmtKg(n180Necessario)} cor="green" destaque />
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

// ─── calculadora NitroPlus ────────────────────────────────────────────────────
function CalcNitroPlus() {
  const [doseN, setDoseN] = useState(20);
  const [area, setArea] = useState(1);
  const [precoNitroPlus, setPrecoNitroPlus] = useState(5.20);
  const [precoUreia, setPrecoUreia] = useState(2.20);

  const nitroPlusNecessario = doseN / NITROPLUS_N_PCT;
  const ureiaNecessaria = doseN / UREIA_N_PCT;
  const custoNitroPlus = nitroPlusNecessario * precoNitroPlus * area;
  const custoUreia = ureiaNecessaria * precoUreia * area;
  const diff = custoNitroPlus - custoUreia;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>NitroPlus — Nitrogênio Estabilizado (30% N).</strong> Formulação com inibidor de urease + inibidor de nitrificação para máxima eficiência em cobertura.
      </div>

      <div className="grid grid-cols-3 gap-3">
        <CampoKg label="Dose N desejada" value={doseN} onChange={setDoseN} sufixo="kg N/ha" />
        <CampoKg label="Área" value={area} onChange={setArea} sufixo="ha" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Preço NitroPlus (R$/kg)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input type="number" min={0} step="0.01" value={precoNitroPlus || ""}
              onChange={(e) => setPrecoNitroPlus(parseFloat(e.target.value) || 0)}
              className="pl-8 pr-10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/kg</span>
          </div>
        </div>
        <CampoPreco label="Preço ureia convencional (comparativo)" value={precoUreia} onChange={setPrecoUreia} />
      </div>

      <Separador titulo="Resultado por hectare" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Resultado label="NitroPlus necessário" valor={fmtKg(nitroPlusNecessario)} cor="green" destaque />
        <Resultado label="Ureia equivalente" valor={fmtKg(ureiaNecessaria)} />
        <Resultado label="Custo NitroPlus" valor={fmtBRL(custoNitroPlus * (1 / area))} cor="green" />
        <Resultado label="Custo ureia/ha" valor={fmtBRL(custoUreia * (1 / area))} cor="amber" />
      </div>

      <Separador titulo={`Custo total (${fmt2(area)} ha)`} />
      <div className="grid grid-cols-3 gap-3">
        <Resultado label="Custo NitroPlus total" valor={fmtBRL(custoNitroPlus)} cor="green" />
        <Resultado label="Custo ureia total" valor={fmtBRL(custoUreia)} />
        <Resultado label={diff >= 0 ? "Custo adicional" : "Economia"} valor={fmtBRL(Math.abs(diff))} cor={diff >= 0 ? "amber" : "green"} destaque />
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
