/**
 * Hooks que carregam o catálogo químico real do Lovable Cloud
 * (fatores de complexação + garantias de matérias-primas)
 * para alimentar o motor da Calculadora Foliar.
 *
 * Substitui as heurísticas antigas (detectarSimbolo / garantiaPadrao)
 * por dados persistidos nas tabelas:
 *   - nutrir_complexador_fatores (144 fatores por complexador × nutriente × nível)
 *   - nutrir_complexadores       (chave canônica: leg, tsh, ion, bor, estimull, amino…)
 *   - nutrir_nutrientes          (símbolos: Mn, Mg, Zn, B, P, K, Ca, S, N…)
 *   - nutrir_mp_garantias        (garantia % por matéria-prima × nutriente)
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FatorComplexacao, SalCatalogo } from "./foliar-engine";

interface ComplexadorRow { id: string; chave: string | null; nome: string }
interface NutrienteRow { id: string; simbolo: string; nome: string }
interface FatorRow { complexador_id: string; nutriente_id: string; nivel: string; fator_l_kg_sal: number }
interface MPRow { id: string; nome: string; preco_atual: number | null }
interface GarantiaRow { materia_prima_id: string; nutriente_id: string; garantia_percentual: number; padrao: boolean | null }

/**
 * Carrega todos os fatores de complexação do banco e devolve
 * um array no formato esperado pelo motor (chave em minúscula + símbolo do nutriente).
 */
export function useFatoresComplexacao() {
  const [fatores, setFatores] = useState<FatorComplexacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cx, nut, fr] = await Promise.all([
        (supabase as any).from("nutrir_complexadores").select("id, chave, nome"),
        (supabase as any).from("nutrir_nutrientes").select("id, simbolo, nome"),
        (supabase as any).from("nutrir_complexador_fatores")
          .select("complexador_id, nutriente_id, nivel, fator_l_kg_sal"),
      ]);
      if (cancelled) return;
      if (cx.error || nut.error || fr.error) {
        console.error("[useFatoresComplexacao]", cx.error || nut.error || fr.error);
        setFatores([]); setLoading(false); return;
      }
      const mapCx = new Map<string, string>();
      (cx.data as ComplexadorRow[]).forEach(c => {
        const chave = (c.chave || c.nome || "").toLowerCase().trim();
        // normaliza nomes comerciais para as chaves usadas pelo motor
        const norm = chave
          .replace(/^complex\s*/i, "")
          .replace(/\s+/g, "")
          .replace(/[^a-z]/g, "");
        mapCx.set(c.id, norm);
      });
      const mapNut = new Map<string, string>();
      (nut.data as NutrienteRow[]).forEach(n => mapNut.set(n.id, n.simbolo));

      const out: FatorComplexacao[] = (fr.data as FatorRow[])
        .map(f => {
          const cx = mapCx.get(f.complexador_id);
          const sym = mapNut.get(f.nutriente_id);
          if (!cx || !sym) return null;
          return {
            complexador: `${cx}_${(f.nivel || "padrao").toLowerCase()}`,
            simbolo: sym,
            fatorLPorKgSal: Number(f.fator_l_kg_sal) || 0,
          } as FatorComplexacao;
        })
        .filter((x): x is FatorComplexacao => x !== null);

      setFatores(out);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { fatores, loading };
}

/**
 * Combina matérias-primas da organização com as garantias cadastradas
 * para devolver um catálogo de sais já no formato do motor.
 */
export function useSaisCatalog(materiasPrimas: MPRow[]) {
  const [garantias, setGarantias] = useState<GarantiaRow[]>([]);
  const [nutrientes, setNutrientes] = useState<NutrienteRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [g, n] = await Promise.all([
        (supabase as any).from("nutrir_mp_garantias")
          .select("materia_prima_id, nutriente_id, garantia_percentual, padrao"),
        (supabase as any).from("nutrir_nutrientes").select("id, simbolo, nome"),
      ]);
      if (cancelled) return;
      setGarantias((g.data as GarantiaRow[]) ?? []);
      setNutrientes((n.data as NutrienteRow[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  const sais: SalCatalogo[] = useMemo(() => {
    const symById = new Map(nutrientes.map(n => [n.id, n.simbolo]));
    return materiasPrimas.map(m => {
      // garantia "padrão" da matéria-prima, ou a maior se não houver padrão marcado
      const candidatas = garantias.filter(x => x.materia_prima_id === m.id);
      const escolhida = candidatas.find(x => x.padrao)
        ?? candidatas.sort((a, b) => Number(b.garantia_percentual) - Number(a.garantia_percentual))[0];
      const sym = escolhida ? symById.get(escolhida.nutriente_id) ?? "?" : "?";
      const garantia = escolhida ? Number(escolhida.garantia_percentual) : 0;
      return {
        id: m.id,
        nome: m.nome,
        precoKg: Number(m.preco_atual ?? 0),
        nutrienteSimbolo: sym,
        garantiaPercent: garantia,
      };
    });
  }, [materiasPrimas, garantias, nutrientes]);

  return { sais, loadingCatalogo: garantias.length === 0 && nutrientes.length === 0 };
}

/**
 * Variante para o motor NPK: cada matéria-prima vira um SalDisponivel com
 * o Record completo de garantias (N, P2O5, K2O, Ca, Mg, S, micros…).
 * Usado pela CalculadoraNPK para selecionar fontes reais de N/P/K do banco.
 */
export function useSaisNPK(materiasPrimas: MPRow[]) {
  const [garantias, setGarantias] = useState<GarantiaRow[]>([]);
  const [nutrientes, setNutrientes] = useState<NutrienteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [g, n] = await Promise.all([
        (supabase as any).from("nutrir_mp_garantias")
          .select("materia_prima_id, nutriente_id, garantia_percentual, padrao"),
        (supabase as any).from("nutrir_nutrientes").select("id, simbolo, nome"),
      ]);
      if (cancelled) return;
      setGarantias((g.data as GarantiaRow[]) ?? []);
      setNutrientes((n.data as NutrienteRow[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const sais = useMemo(() => {
    const symById = new Map(nutrientes.map(n => [n.id, n.simbolo]));
    // mapa simbolo -> chave canônica usada pelo motor (N, P2O5, K2O, Ca, Mg, S…)
    const norm = (sym: string) => {
      const s = (sym || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (s === "P" || s === "P2O5") return "P2O5";
      if (s === "K" || s === "K2O") return "K2O";
      return s;
    };
    return materiasPrimas.map(m => {
      const linhas = garantias.filter(x => x.materia_prima_id === m.id);
      const garantiaMap: Record<string, number> = {};
      linhas.forEach(l => {
        const sym = symById.get(l.nutriente_id);
        if (!sym) return;
        const k = norm(sym);
        // se houver várias linhas para o mesmo nutriente, mantém a maior
        garantiaMap[k] = Math.max(garantiaMap[k] ?? 0, Number(l.garantia_percentual) || 0);
      });
      return {
        id: m.id,
        nome: m.nome,
        precoKg: Number(m.preco_atual ?? 0),
        garantias: garantiaMap,
      };
    });
  }, [materiasPrimas, garantias, nutrientes]);

  return { sais, loading };
}

