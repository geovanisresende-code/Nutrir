import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import { FlaskConical, Droplets, Leaf, FileText, Sprout, TestTube } from "lucide-react";

const calculadoras = [
  {
    to: "/app/rep/calculadora-n180",
    icon: FlaskConical,
    label: "N180 — Ureia Complexada",
    desc: "N180 · N180+B · N180+Micros (NitroPlus) · N32 Foliar · N32+B · NPK Solo",
    color: "text-primary",
    bg: "bg-primary/5 border-primary/20",
  },
  {
    to: "/app/nutrir/calculadora-foliar",
    icon: Leaf,
    label: "Foliar Completa (Micronutrientes)",
    desc: "Receita foliar com micronutrientes · complexadores · custo vs convencional · PDF",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  {
    to: "/app/nutrir/calculadora-npk",
    icon: Droplets,
    label: "NPK Fertirrigação / Drench",
    desc: "N-P-K por nutriente ou fórmula comercial · drench / nonino · custo/ha",
    color: "text-sky-700",
    bg: "bg-sky-50 border-sky-200",
  },
  {
    to: "/app/rep/proposta-tpd",
    icon: FileText,
    label: "Proposta Comercial TPD",
    desc: "Proposta em PDF profissional · custo atual vs TPD · economia projetada",
    color: "text-[#b08826]",
    bg: "bg-[#d4a843]/10 border-[#d4a843]/30",
  },
];

export default function CalculadorasHub() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader
        title="Calculadoras Nutrir"
        description="Escolha o tipo de cálculo"
      />

      <div className="px-4 grid gap-3">
        {calculadoras.map((c) => (
          <Card
            key={c.to}
            className={`cursor-pointer hover:shadow-md transition-all border ${c.bg}`}
            onClick={() => navigate(c.to)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`shrink-0 p-3 rounded-xl ${c.bg}`}>
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${c.color}`}>{c.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
