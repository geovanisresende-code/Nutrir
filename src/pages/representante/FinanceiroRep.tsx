import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/AppShell";
import { DollarSign, FileSpreadsheet, Receipt } from "lucide-react";

// Importa lazy para não carregar tudo de uma vez
import { lazy, Suspense } from "react";
const RDV = lazy(() => import("./RDV"));
const Comissoes = lazy(() => import("./Comissoes"));
const ContasReceber = lazy(() => import("./ContasReceber"));

export default function FinanceiroRep() {
  const [tab, setTab] = useState("rdv");

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Financeiro"
        subtitle="RDV · Comissões · Contas a Receber"
      />

      <div className="px-4 pt-2">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="rdv" className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              RDV
            </TabsTrigger>
            <TabsTrigger value="comissoes" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Comissões
            </TabsTrigger>
            <TabsTrigger value="contas" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Contas a Receber
            </TabsTrigger>
          </TabsList>

          <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>}>
            <TabsContent value="rdv">
              {tab === "rdv" && <RDV />}
            </TabsContent>
            <TabsContent value="comissoes">
              {tab === "comissoes" && <Comissoes />}
            </TabsContent>
            <TabsContent value="contas">
              {tab === "contas" && <ContasReceber />}
            </TabsContent>
          </Suspense>
        </Tabs>
      </div>
    </div>
  );
}
