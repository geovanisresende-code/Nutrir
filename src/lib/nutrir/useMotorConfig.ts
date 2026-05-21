/**
 * useMotorConfig — carrega e salva os parâmetros do motor de cálculos
 * do Supabase (tabela nutrir_motor_config).
 *
 * Fallback: se a tabela não existir ou org não tiver dados, usa os
 * valores do DOCX como default.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";

export interface MotorParam {
  id?: string;
  chave: string;
  categoria: string;
  label: string;
  valor: number;
  unidade?: string;
  descricao?: string;
}

/** Valores padrão do DOCX — usados como fallback quando não há config no banco */
export const MOTOR_DEFAULTS: MotorParam[] = [
  // Redução
  { chave: "reducao_ureia_branca",     categoria: "reducao",    label: "Ureia Branca — redução (%)",          valor: 60,    unidade: "%",    descricao: "Redução de dose ao substituir por N180" },
  { chave: "reducao_ureia_protegida",  categoria: "reducao",    label: "Ureia Protegida — redução (%)",       valor: 55,    unidade: "%",    descricao: "Redução ao substituir ureia protegida" },
  { chave: "reducao_sulfato_parcial",  categoria: "reducao",    label: "Sulfato Amônio — redução parcial (%)",valor: 50,    unidade: "%",    descricao: "Redução do restante após lanço" },
  { chave: "reducao_nitrato_amonio",   categoria: "reducao",    label: "Nitrato Amônio — redução N (%)",      valor: 45,    unidade: "%",    descricao: "Redução do N ao substituir nitrato" },
  { chave: "sulfato_limite_parcial",   categoria: "reducao",    label: "Sulfato: limite subst. total (kg/ha)", valor: 300, unidade: "kg/ha", descricao: "≤ este valor: substituição completa (0 à lanço). > este → 150 kg à lanço." },
  { chave: "sulfato_limite_maximo",    categoria: "reducao",    label: "Sulfato: máx à lanço quando > 400 kg/ha", valor: 200, unidade: "kg/ha", descricao: "Quando dose > 400 kg/ha: este valor vai à lanço (máximo)" },
  // Complexantes
  { chave: "tsh_pct_ureia",            categoria: "complexante",label: "TSH — % sobre ureia",                 valor: 15,    unidade: "%",    descricao: "15 mL TSH por 100g ureia na calda" },
  { chave: "lifegrow_pct_ureia",       categoria: "complexante",label: "Life Grow — % sobre ureia",           valor: 18.75, unidade: "%",    descricao: "18,75 mL Life Grow por 100g ureia" },
  { chave: "leg_pct_ureia",            categoria: "complexante",label: "LEG — % sobre ureia",                 valor: 6.25,  unidade: "%",    descricao: "6,25 mL LEG por 100g ureia" },
  // Receita N180
  { chave: "n180_ureia_kg_1000l",      categoria: "receita",    label: "N180: Ureia por 1.000 L (kg)",        valor: 400,   unidade: "kg",   descricao: "Receita padrão: 400 kg ureia / 1.000 L" },
  { chave: "n180_n_g_por_l",           categoria: "receita",    label: "N180: concentração N (g/L)",          valor: 180,   unidade: "g/L",  descricao: "180 g de N por litro de N180" },
  // Boro
  { chave: "acido_borico_b_pct",       categoria: "boro",       label: "Ácido Bórico — teor B (%)",           valor: 17,    unidade: "%",    descricao: "Teor de Boro no ácido bórico" },
  { chave: "bor_l_por_kg_acido",       categoria: "boro",       label: "Bor — L por kg de ác. bórico",        valor: 0.65,  unidade: "L/kg", descricao: "Volume de Bor por kg de ácido bórico" },
  // N32
  { chave: "n32_n_pct",                categoria: "n32",        label: "N32 — teor de N (%)",                 valor: 32,    unidade: "%",    descricao: "Garantia N do produto N32 (UAN)" },
  { chave: "n32_leg_pct_ureia",        categoria: "n32",        label: "N32: LEG — % sobre ureia",            valor: 18.75, unidade: "%",    descricao: "LEG para formulação N32 foliar" },
  // NPK Solo
  { chave: "npk_ureia_max_1000l",      categoria: "npk",        label: "NPK: Ureia máx / 1.000 L (kg)",       valor: 300,   unidade: "kg",   descricao: "Máx 300 kg ureia / 1.000 L (3,33x)" },
  { chave: "npk_kcl_max_1000l",        categoria: "npk",        label: "NPK: KCl máx / 1.000 L (kg)",         valor: 200,   unidade: "kg",   descricao: "Máx 200 kg KCl / 1.000 L (5x)" },
  { chave: "npk_map_max_1000l",        categoria: "npk",        label: "NPK: MAP máx / 1.000 L (kg)",         valor: 200,   unidade: "kg",   descricao: "Máx 200 kg MAP / 1.000 L (5x)" },
  { chave: "npk_tsh_pct_ureia",        categoria: "npk",        label: "NPK: TSH sobre Ureia (%)",             valor: 12.5,  unidade: "%",    descricao: "12,5% TSH sobre ureia na calda NPK" },
  { chave: "npk_tsh_pct_kcl",          categoria: "npk",        label: "NPK: TSH sobre KCl (%)",              valor: 10,    unidade: "%",    descricao: "10% TSH sobre KCl" },
  { chave: "npk_tsh_pct_map",          categoria: "npk",        label: "NPK: TSH sobre MAP (%)",              valor: 10,    unidade: "%",    descricao: "10% TSH sobre MAP" },
  // N180 + Boro (N180+B) — parâmetros do sulco e receita
  { chave: "n180b_boro_sulco_g_ha",    categoria: "n180b",      label: "Boro no sulco (g/ha)",                 valor: 80,    unidade: "g/ha", descricao: "Dose máxima de boro aplicada no sulco de plantio" },
  { chave: "n180b_sulco_vazao_l_ha",   categoria: "n180b",      label: "Vazão do sulco com boro (L/ha)",       valor: 40,    unidade: "L/ha", descricao: "Volume de calda no sulco (N180+B)" },
  { chave: "n180b_ab_kg_por_1000l",    categoria: "n180b",      label: "Ácido Bórico no sulco (kg/1.000L)",   valor: 12,    unidade: "kg",   descricao: "Receita do sulco: ácido bórico por 1.000 L de calda" },
  { chave: "n180b_bor_l_por_1000l",    categoria: "n180b",      label: "Bor no sulco (L/1.000L)",             valor: 7.5,   unidade: "L",    descricao: "Receita do sulco: Bor por 1.000 L de calda" },
  // N32+B Foliar — parâmetros do cálculo
  { chave: "n32b_n_ajuste_pct",        categoria: "n32b",       label: "N32+B: ajuste N (%)",                 valor: 15,    unidade: "%",    descricao: "Acréscimo sobre o N do produto N32 para compensar absorção foliar" },
  { chave: "n32b_leg_pct_ureia",       categoria: "n32b",       label: "N32+B: LEG sobre ureia (%)",          valor: 18.75, unidade: "%",    descricao: "18,75% de LEG sobre a ureia convertida na calda N32+B" },
  { chave: "n32b_calda_boro_fator",    categoria: "n32b",       label: "N32+B: fator calda boro (L/kg AB)",   valor: 2.8,   unidade: "L/kg", descricao: "Volume de calda do boro = ácido bórico (kg) × este fator" },
  // Preços padrão
  { chave: "preco_ureia_kg",           categoria: "precos",     label: "Ureia branca (R$/kg)",                 valor: 2.20,  unidade: "R$/kg",descricao: "Preço padrão da ureia branca" },
  { chave: "preco_tsh_l",             categoria: "precos",     label: "TSH (R$/L)",                           valor: 16.5,  unidade: "R$/L", descricao: "Preço padrão TSH" },
  { chave: "preco_lifegrow_l",         categoria: "precos",     label: "Life Grow (R$/L)",                     valor: 25.0,  unidade: "R$/L", descricao: "Preço padrão Life Grow" },
  { chave: "preco_leg_l",              categoria: "precos",     label: "LEG (R$/L)",                           valor: 22.0,  unidade: "R$/L", descricao: "Preço padrão LEG" },
  { chave: "preco_kcl_kg",             categoria: "precos",     label: "KCl branco (R$/kg)",                   valor: 2.80,  unidade: "R$/kg",descricao: "Preço padrão KCl" },
  { chave: "preco_map_kg",             categoria: "precos",     label: "MAP purificado (R$/kg)",               valor: 4.50,  unidade: "R$/kg",descricao: "Preço padrão MAP" },
  { chave: "preco_acido_borico_kg",    categoria: "precos",     label: "Ácido Bórico (R$/kg)",                 valor: 18.0,  unidade: "R$/kg",descricao: "Preço padrão ácido bórico" },
  { chave: "preco_bor_l",              categoria: "precos",     label: "Bor complexado (R$/L)",                valor: 32.0,  unidade: "R$/L", descricao: "Preço padrão Bor líquido" },
];

/** Converte array de params em mapa chave → valor */
export function paramMap(params: MotorParam[]): Record<string, number> {
  return Object.fromEntries(params.map(p => [p.chave, p.valor]));
}

export function useMotorConfig() {
  const { current: org } = useOrg();
  const [params, setParams] = useState<MotorParam[]>(MOTOR_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("nutrir_motor_config")
        .select("*")
        .eq("organization_id", org.id);

      if (error || !data?.length) {
        // Tabela não existe ainda ou sem dados — usa defaults
        setParams(MOTOR_DEFAULTS);
      } else {
        // Merge: defaults como base + valores do banco por cima
        const dbMap: Record<string, MotorParam> = {};
        data.forEach((r: any) => { dbMap[r.chave] = r; });

        const merged = MOTOR_DEFAULTS.map(def => ({
          ...def,
          ...(dbMap[def.chave] ?? {}),
          valor: dbMap[def.chave]?.valor ?? def.valor,
        }));
        // Inclui parâmetros customizados (no banco mas não nos defaults)
        const defaultChaves = new Set(MOTOR_DEFAULTS.map(d => d.chave));
        const custom = data.filter((r: any) => !defaultChaves.has(r.chave));
        setParams([...merged, ...custom]);
      }
    } catch {
      setParams(MOTOR_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (updated: MotorParam[]) => {
    if (!org) return false;
    setSaving(true);
    try {
      const rows = updated.map(p => ({
        organization_id: org.id,
        chave: p.chave,
        categoria: p.categoria,
        label: p.label,
        valor: p.valor,
        unidade: p.unidade ?? null,
        descricao: p.descricao ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await (supabase as any)
        .from("nutrir_motor_config")
        .upsert(rows, { onConflict: "organization_id,chave" });
      if (error) throw error;
      setParams(updated);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [org]);

  return { params, loading, saving, save, reload: load };
}
