Remove-Item "C:\Users\Geovani\Downloads\agromap-nutrir-unificado\.git\index.lock" -Force -ErrorAction SilentlyContinue
cd "C:\Users\Geovani\Downloads\agromap-nutrir-unificado"
git add -A
git commit -m "feat: PDF padronizado em todas calculadoras - N32, N32B, NitroPlus com comparativo, lista compras, receita"
git push
Write-Host "Tudo enviado! Vercel vai deployar em 1-2 min." -ForegroundColor Green
