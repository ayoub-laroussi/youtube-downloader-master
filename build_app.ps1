$ErrorActionPreference = "Stop"

Write-Host "Nettoyage du dossier de build..."
if (Test-Path "dist") {
    Remove-Item "dist" -Recurse -Force
}

Write-Host "Construction de l'application via Electron Builder..."
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
cmd.exe /c npm run build

Write-Host "Build terminé ! L'installateur se trouve dans le dossier 'dist/'."
