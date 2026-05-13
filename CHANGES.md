# Mudanças aplicadas na unificação

## 1. Sidebar Navigation (src/components/layout/AppSidebar.tsx)
Reorganizado com **submenus aninhados**, agrupando os ícones em grupos
expansíveis conforme a especificação:

- **Área do Representante** com 3 grupos: Relatório de Visitas, Programa Nutrir, Mapas e Talhões, IA Agronômica
- **Área do Gerente** (Dashboard / Ouvidoria / Equipe / Aprovações)
- **Gestão do Programa** (somente ADM) com grupos: BD de Produtos, Motor de Cálculos
- **Financeiro & Operações** + **Administração** (níveis configuráveis)

Gating por papel via `useUserRole` + `usePosition` + `can()`.

## 2. Painel Custo de Análise (src/pages/nutrir/PainelCustoAnalise.tsx)
Era um redirect (7 linhas) → expandido para 200 linhas, agora:
- Mostra ao Representante o custo da amostra calculado pelo ADM (read-only).
- Permite ao ADM/Diretor editar a margem inline (botão "Alterar margem").
- Mostra Preço final / amostra e Preço por ha calculado.

## 3. Coletar Amostras (src/pages/nutrir/ColetarAmostras.tsx)
Era um stub (29 linhas) → 340 linhas funcionais:
- Seleção Cliente → Fazenda → Talhão → Cultura.
- "Iniciar Coleta" liga GPS contínuo + busca meteorologia local (open-meteo).
- "Marcar Subamostra" gera nomenclatura automática:
  - Nome longo: `Subamostra X da Amostra Composta Y, Talhão Z, Fazenda Nome, data, hora, cultura`
  - Abrev: `SA{sub}.{amostra}.{talhão} {Fazenda}`  →  `SA1.3.1 Santa Rita`
- Persiste em `collection_points` com meteorologia anexada.

## 4. Orçamento Consultoria + Nutrição (src/pages/nutrir/OrcamentoConsultoriaNutricao.tsx)
Era um hub (56 linhas) → 470 linhas, wizard de 4 passos:
1. **Cliente:** importar do cadastro ou manual.
2. **Fazendas & Cultivos:** add/remove fazendas, cultivos com:
   - Cultura (preenche `n_amostras_ciclo` automaticamente: soja=5, milho=4, perene=8, anual=4)
   - Área em ha
   - Modo GRIDE (xx ha/amostra) **ou** Talhão (n→ gride calculado)
   - Preview: amostras = ⌈(área / gride) × (n / 4)⌉, custo/ha
3. **Nutrição:** seleção das adubações (N180, N180+B, N180+micros, N32, N32+B, NPK, Foliar) + vazão pulverizador + observação.
4. **Resumo / PDF:** subtotal, desconto (consultoria + complexadores), TOTAL, chamada para `gerarOrcamentoCompletoPDF`.

## 5. PDF unificado (src/lib/nutrir/pdf-unified.ts)
Adicionado `gerarOrcamentoCompletoPDF`:
- Capa Canva-style (cor Nutrir + dourado)
- Página 2: detalhamento por fazenda (tabela cultura × área × gride × amostras × custo/ha × subtotal × adubação)
- Resumo financeiro com desconto e TOTAL destacado
- Última página: comparativo Convencional × Programa Nutrir
- Download automático com nome do cliente

## 6. README.md
Reescrito documentando:
- Como rodar
- Mapa do sidebar (5 blocos)
- Matriz de papéis × capabilities
- Estado de cada módulo (implementado vs. esqueleto)
- Arquitetura do motor de cálculos
- Próximas rodadas sugeridas
