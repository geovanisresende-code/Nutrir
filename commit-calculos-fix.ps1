Remove-Item "C:\Users\Geovani\Downloads\agromap-nutrir-unificado\.git\index.lock" -Force -ErrorAction SilentlyContinue
cd "C:\Users\Geovani\Downloads\agromap-nutrir-unificado"
git add -A
git commit -m "fix: N32 garantia corrigida para 320 g/L conforme DOCX + engine restaurado"
git push
Write-Host "Calculos corrigidos e enviados!" -ForegroundColor Green
