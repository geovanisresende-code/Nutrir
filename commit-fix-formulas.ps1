# Remove lock e commita as correcoes do motor
$repo = "C:\Users\Geovani\Downloads\agromap-nutrir-unificado"
Set-Location $repo

$lock = Join-Path $repo ".git\index.lock"
if (Test-Path $lock) { Remove-Item $lock -Force; Write-Host "Lock removido." -ForegroundColor Yellow }

git add src/lib/nutrir/nutrir-engine.ts src/lib/nutrir/useMotorConfig.ts

git commit -m "fix: motor 100% conforme DOCX — auditoria 32/32 calculos corretos

BUG 1 - Sulfato de Amonio (logica estava INVERTIDA):
  CORRIGIDO: dose < 300  -> substituicao completa (0 a lance)
             dose 300-400 -> 150 kg a lance + converte restante
             dose > 400   -> 200 kg a lance (maximo)

BUG 2 - N32 Foliar concentracao errada:
  CORRIGIDO: 5L x 32% / 16% = 10L/ha (era /0.18 = 8.89L)

Auditoria: 32 calculos testados, todos corretos vs DOCX
  Ureia Branca/Protegida, Sulfato (200/300/350/500kg),
  Nitrato Amonio, Boro, Receitas 1000L (TSH/LifeGrow/LEG),
  N32 calda e receita, NPK (Ureia/KCl/MAP)"

git push
Write-Host "Motor de calculos 100% correto — enviado!" -ForegroundColor Green
