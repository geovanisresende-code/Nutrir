# Remove lock se existir e commit as mudancas do motor de calculos
$repo = "C:\Users\Geovani\Downloads\agromap-nutrir-unificado"
Set-Location $repo

$lock = Join-Path $repo ".git\index.lock"
if (Test-Path $lock) {
    Remove-Item $lock -Force
    Write-Host "Lock removido." -ForegroundColor Yellow
}

git add -A
git commit -m "feat: motor de calculos conectado ao Supabase

- nutrir-engine.ts: CalcInput aceita motorConfig (Record<string,number>)
  - calcularSubstituicao usa reducoes configuradas (ureia_branca, ureia_protegida, nitrato, sulfato)
  - COMPLEX_PCT derivado de tsh_pct_ureia / lifegrow_pct_ureia / leg_pct_ureia do config
  - UREIA_PCT_VOL derivado de n180_ureia_kg_1000l / 1000
  - BORO_CONC_ACIDO e BOR_L_POR_KG_ACIDO configuráveis via motor config
  - buildPrecos() mescla precos do motor config com PRECOS_DEFAULT
  - aplicarMicrosNasAplicacoes aceita complexPct dinamico
- CalculadoraN180.tsx: usa useMotorConfig para inicializar precos
  - ureiaKgPerLN180 derivado de n180_ureia_kg_1000l
  - Precos inicializados via useEffect apos motor config carregar"

git push
Write-Host "Pronto! Motor de calculos integrado ao Supabase." -ForegroundColor Green
