import {
  Sprout,
  Wheat,
  Apple,
  Citrus,
  Grape,
  Cherry,
  Banana,
  Leaf,
  TreePine,
  TreeDeciduous,
  Coffee,
  Carrot,
  Flower2,
  Nut,
  Bean,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa de ícones (lucide) por nome de cultura, com cor de marca por grupo.
 * Cobre todas as 51 culturas do seed; fallback genérico para qualquer outra.
 */
type IconConfig = { icon: LucideIcon; tone: string };

const FRUIT: IconConfig = { icon: Apple, tone: "text-rose-600 bg-rose-50" };
const CITRUS: IconConfig = { icon: Citrus, tone: "text-amber-600 bg-amber-50" };
const GRAIN: IconConfig = { icon: Wheat, tone: "text-yellow-700 bg-yellow-50" };
const LEGUME: IconConfig = { icon: Bean, tone: "text-emerald-700 bg-emerald-50" };
const ROOT: IconConfig = { icon: Carrot, tone: "text-orange-600 bg-orange-50" };
const TREE: IconConfig = { icon: TreePine, tone: "text-green-800 bg-green-50" };
const TROPICAL: IconConfig = { icon: Banana, tone: "text-yellow-600 bg-yellow-50" };
const FLOWER: IconConfig = { icon: Flower2, tone: "text-pink-600 bg-pink-50" };
const COFFEE_C: IconConfig = { icon: Coffee, tone: "text-amber-800 bg-amber-50" };
const NUT: IconConfig = { icon: Nut, tone: "text-stone-700 bg-stone-100" };
const VINE: IconConfig = { icon: Grape, tone: "text-purple-700 bg-purple-50" };
const HERB: IconConfig = { icon: Leaf, tone: "text-emerald-600 bg-emerald-50" };
const DECID: IconConfig = { icon: TreeDeciduous, tone: "text-lime-700 bg-lime-50" };
const CHERRYISH: IconConfig = { icon: Cherry, tone: "text-red-600 bg-red-50" };

const MAP: Record<string, IconConfig> = {
  abacaxi: TROPICAL,
  algodão: { icon: Flower2, tone: "text-slate-600 bg-slate-100" },
  alho: { icon: Sprout, tone: "text-zinc-600 bg-zinc-100" },
  amendoim: NUT,
  arroz: GRAIN,
  aveia: GRAIN,
  açaí: { icon: Cherry, tone: "text-purple-800 bg-purple-50" },
  banana: TROPICAL,
  batata: ROOT,
  "batata-doce": ROOT,
  cacau: CHERRYISH,
  "café arábica": COFFEE_C,
  "café conilon": COFFEE_C,
  "cana-de-açúcar": { icon: Sprout, tone: "text-lime-700 bg-lime-50" },
  canola: { icon: Flower2, tone: "text-yellow-500 bg-yellow-50" },
  cebola: { icon: Sprout, tone: "text-purple-600 bg-purple-50" },
  cenoura: ROOT,
  centeio: GRAIN,
  cevada: GRAIN,
  coco: TROPICAL,
  dendê: TROPICAL,
  "erva-mate": HERB,
  eucalipto: TREE,
  feijão: LEGUME,
  gergelim: { icon: Sprout, tone: "text-amber-700 bg-amber-50" },
  girassol: { icon: Flower2, tone: "text-yellow-600 bg-yellow-50" },
  goiaba: FRUIT,
  guaraná: CHERRYISH,
  laranja: CITRUS,
  limão: CITRUS,
  mamona: { icon: Leaf, tone: "text-green-700 bg-green-50" },
  mamão: TROPICAL,
  mandioca: ROOT,
  manga: FRUIT,
  maracujá: { icon: Flower2, tone: "text-violet-600 bg-violet-50" },
  maçã: FRUIT,
  melancia: { icon: Apple, tone: "text-emerald-600 bg-emerald-50" },
  melão: { icon: Apple, tone: "text-yellow-600 bg-yellow-50" },
  milheto: GRAIN,
  milho: { icon: Wheat, tone: "text-yellow-600 bg-yellow-50" },
  pastagem: HERB,
  "pimenta-do-reino": { icon: Sprout, tone: "text-red-700 bg-red-50" },
  pinus: TREE,
  seringueira: DECID,
  soja: LEGUME,
  sorgo: GRAIN,
  tabaco: HERB,
  tomate: { icon: Apple, tone: "text-red-600 bg-red-50" },
  trigo: GRAIN,
  triticale: GRAIN,
  uva: VINE,
};

export function getCulturaIcon(nome: string): IconConfig {
  const key = (nome ?? "").trim().toLowerCase();
  return MAP[key] ?? { icon: Sprout, tone: "text-primary bg-primary/10" };
}
