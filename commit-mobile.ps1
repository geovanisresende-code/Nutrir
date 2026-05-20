Remove-Item "C:\Users\Geovani\Downloads\agromap-nutrir-unificado\.git\index.lock" -Force -ErrorAction SilentlyContinue
cd "C:\Users\Geovani\Downloads\agromap-nutrir-unificado"
git add -A
git commit -m "feat: mobile UX - bottom nav + RDV no sidebar + RDV responsivo"
git push
Write-Host "Mobile melhorado e enviado!" -ForegroundColor Green
