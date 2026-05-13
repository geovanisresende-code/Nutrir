# Mensagem pronta pra enviar ao cliente

Copie o bloco abaixo e cole no WhatsApp/email pro cliente, **trocando os 3 valores destacados**:
- `[URL_VERCEL]` → URL real do Vercel (ex: `https://agromap-nutrir-abc123.vercel.app`)
- `[EMAIL_CLIENTE]` → email da conta de teste que você criou no Supabase
- `[SENHA_TESTE]` → senha da conta de teste

---

```
Olá! Te envio o acesso para testar a plataforma AgroMap × Nutrir 🌱

🔗 LINK: [URL_VERCEL]/auth
📧 EMAIL: [EMAIL_CLIENTE]
🔑 SENHA: [SENHA_TESTE]

Recomendado: use Chrome ou Edge, em computador. Funciona também no celular (pode "Adicionar à tela inicial" para virar um app).

═══════════════════════════════════
ROTEIRO SUGERIDO DE TESTE
═══════════════════════════════════

1️⃣ CADASTRO DE CLIENTE
   Menu → Clientes → +Novo Cliente
   • Testa cadastrar um Produtor Rural (com CPF + 1 fazenda)
   • Testa cadastrar uma Revenda (com CNPJ)
   • Para o Produtor, adiciona 1-2 propriedades com nome/IE/endereço

2️⃣ ORÇAMENTO DE CONSULTORIA
   Menu → Programa Nutrir → Orçamento de Consultoria
   • Seleciona o cliente cadastrado
   • Adiciona 1-2 cultivos (cultura, área em ha)
   • Testa GRIDE (ex: 50 ha/amostra) E Talhão (10 talhões)
   • Vê o cálculo de amostras e R$/ha aparecendo automaticamente
   • Clica "Gerar Orçamento" → PDF

3️⃣ ORÇAMENTO COMPLETO (NUTRIÇÃO)
   Menu → Programa Nutrir → Orçamento + Nutrição
   • Wizard de 4 passos
   • Marca tipos de adubação (N180, NPK, Foliar, etc.)
   • Aplica desconto no resumo
   • Gera PDF unificado com capa + detalhamento + comparativo

4️⃣ RELATÓRIO DE VISITA
   Menu → Área do Representante → Relatório de Visitas → Registrar Visita
   • Seleciona cliente, motivo (ex: Visita de Rotina)
   • Escreve relato
   • Testa os 3 níveis de alerta (Muito Urgente, Ponto de Atenção, Relato de Rotina)

5️⃣ RDV (RELATÓRIO DE DESPESA DE VIAGEM)
   Menu → Área do Representante → RDV
   • Adiciona despesa (combustível, hospedagem, etc.)
   • Anexa foto/scan da nota fiscal

6️⃣ MAPAS E COLETA
   Menu → Mapas e Talhões → Criar Mapas (desenhar área)
   Menu → Mapas e Talhões → Coletar Amostras (autorize GPS no navegador)
   • Inicia coleta → marca pontos → vê nomenclatura SA1.1.1 etc.

7️⃣ CALCULADORAS
   Menu → Programa Nutrir → Calculadora NPK
   Menu → Programa Nutrir → Calculadora Foliar
   • Insere cultura/área/vazão, calcula formulação, gera PDF

8️⃣ IA AGRONÔMICA (preview)
   Menu → IA Agronômica → Análise de Solo
   • Sobe um PDF de análise (se tiver) ou preenche manualmente
   • Configura V%, produtividade esperada
   • Recebe interpretação + receita de correção

═══════════════════════════════════
OBSERVAÇÕES
═══════════════════════════════════

⚠️ Plataforma em FASE DE TESTES. Os seguintes módulos
   estão como esqueleto/preview e serão aprofundados:
   • NDVI em tempo real (depende de plugar provedor de satélite)
   • Identificação visual de sintomas foliares por IA
   • Comparativo Convencional × Nutrir (valores estimados)

✅ Tudo o mais está funcional e persiste em banco — pode
   cadastrar dados de verdade que ficam salvos.

═══════════════════════════════════
PRA REPORTAR PROBLEMAS
═══════════════════════════════════

Me manda por aqui mesmo:
• O que você estava tentando fazer
• O que esperava acontecer
• O que aconteceu (com print/foto da tela se possível)
• A página/URL onde aconteceu

Qualquer dúvida ou sugestão, chama! 🚀
```

---

## Versão curta (se preferir mais direta)

```
Plataforma AgroMap × Nutrir pra você testar 🌱

🔗 [URL_VERCEL]/auth
📧 [EMAIL_CLIENTE]
🔑 [SENHA_TESTE]

Roda melhor em Chrome desktop. Pode cadastrar dados reais — fica salvo.

Sugestões pra testar:
• Clientes (cadastro)
• Orçamento Consultoria (Programa Nutrir)
• Calculadoras NPK e Foliar
• Relatório de Visitas
• Coletar Amostras (GPS no celular)

Manda print de qualquer problema que encontrar!
```
