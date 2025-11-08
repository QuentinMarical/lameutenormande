# Script PowerShell pour mettre à jour le cache de coordonnées GPS
# Exécute le script Node.js si disponible, sinon affiche les instructions

Write-Host "`n??????????????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "?  ??? MISE À JOUR DU CACHE CARTE                   ?" -ForegroundColor Green
Write-Host "??????????????????????????????????????????????????????`n" -ForegroundColor Cyan

# Vérifier si Node.js est installé
$nodeInstalled = $false
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        $nodeInstalled = $true
        Write-Host "? Node.js détecté: $nodeVersion" -ForegroundColor Green
    }
} catch {
    $nodeInstalled = $false
}

if ($nodeInstalled) {
    Write-Host "`n?? Génération du cache en cours...`n" -ForegroundColor Yellow
    
    # Exécuter le script Node.js
    node generate-map-cache.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n? Cache mis à jour avec succès!" -ForegroundColor Green
        Write-Host "   ?? Fichier: assets\data\events-map-cache.json" -ForegroundColor White
        Write-Host "`n?? La carte sera maintenant INSTANTANÉE au chargement!" -ForegroundColor Cyan
    } else {
        Write-Host "`n? Erreur lors de la génération du cache" -ForegroundColor Red
    }
} else {
    Write-Host "? Node.js n'est pas installé" -ForegroundColor Red
    Write-Host "`n?? INSTRUCTIONS MANUELLES:" -ForegroundColor Yellow
    Write-Host "`n1. Installer Node.js:" -ForegroundColor White
    Write-Host "   https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "`n2. Redémarrer PowerShell" -ForegroundColor White
    Write-Host "`n3. Exécuter à nouveau ce script" -ForegroundColor White
    Write-Host "`nOU" -ForegroundColor Yellow
    Write-Host "`nUtiliser le cache manuel dans:" -ForegroundColor White
    Write-Host "   assets\data\events-map-cache.json" -ForegroundColor Cyan
    Write-Host "`nAjouter manuellement les coordonnées GPS:" -ForegroundColor White
    Write-Host '   "Nom Ville, France": { "lat": XX.XXXX, "lon": X.XXXX }' -ForegroundColor Gray
}

Write-Host "`n" -NoNewline
pause
