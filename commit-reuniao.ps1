Remove-Item "C:\Users\Geovani\Downloads\agromap-nutrir-unificado\.git\index.lock" -Force -ErrorAction SilentlyContinue
cd "C:\Users\Geovani\Downloads\agromap-nutrir-unificado"
git add -A
git commit -m "feat: Gerar Recomendacao PDF + Pedido Fertagro + pre-fill proposta N180"
git push
Write-Host "Tudo enviado! Vercel vai deployar em 1-2 min." -ForegroundColor Green
