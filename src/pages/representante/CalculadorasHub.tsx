import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import { Leaf, Droplets, FlaskConical, FileText } from "lucide-react";

const calculadoras = [
  {
    to: "/app/nutrir/calculadora-foliar",
    icon: Leaf,
    label: "Foliar Complexada",
    desc: "Receita foliar NUTRIR com complexadores · convencional vs NUTRIR · PDF",
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  {
    to: "/app/nutrir/calculadora-npk",
    icon: Droplets,
    label: "NPK Fertirrigação",
    desc: "Drench N-P-K por nutriente ou fórmula · custo/ha · comparativo vs matéria-prima",
    color: "text-sky-600",
    bg: "bg-sky-50 border-sky-200",
  },
  {
    to: "/app/nutrir/calculadora-npk",
    icon: FlaskConical,
    label: "N180 / K180 (TPD)",
    desc: "Produção de fertilizante líquido na fazenda · N180 + K180 · bateladas · economia",
    color: "text-primary",
    bg: "bg-primary/5 border-primary/20",
  },
  {
    to: "/app/rep/proposta-tpd",
    icon: FileText,
    label: "Proposta Comercial TPD",
    desc: "Gera proposta em PDF estilo profissional · custo atual vs TPD · economia projetada",
    color: "text-[#b08826]",
    bg: "bg-[#d4a843]/10 border-[#d4a843]/30",
  },
];

export default function CalculadorasHub() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader
        title="Calculadoras"
        description="Escolha o cálculo que precisa fazer"
      />

      <div className="px-4 grid gap-3">
        {calculadoras.map((c) => (
          <Card
            key={c.to + c.label}
            className={`cursor-pointer hover:shadow-md transition-all border ${c.bg}`}
            onClick={() => navigate(c.to)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`shrink-0 p-2.5 rounded-xl ${c.bg}`}>
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${c.color}`}>{c.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
