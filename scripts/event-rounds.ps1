# Puts the REAL event times back on PROD: Oct 22, 10:00-11:30, 12:30-14:00, 15:00-16:00 (IST).
# Run from C:\Duo Game:   .\scripts\event-rounds.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:GOOGLE_APPLICATION_CREDENTIALS = Join-Path (Get-Location) "key.json"
npx tsx scripts/oneDayEvent.ts --prod --project decade-hunt-66f6e
Write-Host "Real Oct 22 times are back. Before 10:00 also run the reset script (scripts/resetForEvent.ts)." -ForegroundColor Green
