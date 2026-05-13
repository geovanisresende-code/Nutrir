# Deploy — passo-a-passo (≈10 minutos)

Sequência otimizada pra ir do código local até URL pública pro cliente testar.

---

## 1️⃣ Cria repositório no GitHub (2 min)

1. Acesse **https://github.com/new**
2. Repository name: `agromap-nutrir`
3. Marque **Private**
4. **Não** marque nenhuma das opções de inicializar (README, gitignore, license)
5. **Create repository**
6. Na tela seguinte, copie a URL do repo (algo tipo `https://github.com/SEU_USUARIO/agromap-nutrir.git`)

## 2️⃣ Sobe o código (terminal do VS Code)

Cola no terminal, **trocando SEU_USUARIO**:

```powershell
cd C:\Users\Geovani\Downloads\agromap-nutrir-unificado
git init
git add .
git commit -m "Initial commit: AgroMap × Nutrir unified"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/agromap-nutrir.git
git push -u origin main
```

Se for a primeira vez no Git, antes desses comandos roda:

```powershell
git config --global user.email "seu@email.com"
git config --global user.name "Seu Nome"
```

Quando pedir autenticação no push, escolha **"Sign in with browser"** e autorize.

## 3️⃣ Deploy no Vercel (3 min)

1. Acesse **https://vercel.com/signup** → **"Continue with GitHub"** → autoriza
2. Na home do Vercel, clique **"Add New… → Project"**
3. Na lista de repos, encontra `agromap-nutrir` → clica **"Import"**
4. A tela de configuração:
   - **Framework Preset:** Vite (já detectado automaticamente)
   - **Build Command:** `npm run build` (já preenchido)
   - **Output Directory:** `dist` (já preenchido)
   - **Install Command:** `npm install` (default ok)
5. Expande **"Environment Variables"** e adiciona estas 3:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://wkvvgsjunippzwpybaeb.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdnZnc2p1bmlwcHp3cHliYWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDg4NzgsImV4cCI6MjA5NDE4NDg3OH0._5mty8ekIRlwYHfPMjopFuLpe7MjeApzLdCRNGjQVP0` |
   | `VITE_SUPABASE_PROJECT_ID` | `wkvvgsjunippzwpybaeb` |

6. **"Deploy"** — espera ~2 min.

Vai sair uma URL tipo `https://agromap-nutrir-abc123.vercel.app`. **Anote essa URL.**

## 4️⃣ Adiciona a URL no Supabase (1 min)

Acessa **https://supabase.com/dashboard/project/wkvvgsjunippzwpybaeb/auth/url-configuration**

Em **Redirect URLs** clica **"Add URL"** 2 vezes e adiciona (trocando pela URL real do Vercel):

```
https://agromap-nutrir-abc123.vercel.app/**
https://agromap-nutrir-abc123.vercel.app/app
```

**Site URL** — pode trocar para a URL do Vercel ou deixar localhost. Recomendo trocar para Vercel se for o ambiente principal de teste.

**Save**.

## 5️⃣ Cria usuário de teste pro cliente

**https://supabase.com/dashboard/project/wkvvgsjunippzwpybaeb/auth/users** → **"Add user → Create new user"**

- Email: `cliente@empresa.com` (use o email real do cliente se quiser)
- Password: `Teste123!` (algo simples)
- ✓ **Auto Confirm User**
- **Create user**

## 6️⃣ Envia pro cliente

Cola a mensagem pronta de `MENSAGEM-CLIENTE.md` (ver arquivo separado) trocando a URL.

---

## Updates futuros

Toda vez que você fizer mudanças e quiser publicar:

```powershell
git add .
git commit -m "descrição curta da mudança"
git push
```

O Vercel detecta o push e re-deploya automaticamente em ~1 min.

## Troubleshooting

| Erro | Solução |
|---|---|
| Build no Vercel falha com `MODULE_NOT_FOUND @rollup/...` | Em **Settings → General → Build & Development Settings → Install Command**, use: `npm ci --legacy-peer-deps` |
| 404 ao acessar rotas direto (`/app`, `/auth`) | Já resolvido pelo `vercel.json` (rewrites). Se ainda der, redeployar. |
| Login dá "Invalid credentials" | Refizeram os passos 4 (Site URL/Redirect URLs)? Cliente tem que abrir a URL do Vercel, não localhost |
| Tela branca após deploy | F12 do navegador → aba Console → manda o erro |
