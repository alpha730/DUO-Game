# Quick test rounds on PROD: 3 rounds of $Minutes minutes each, 1 minute apart, starting 1 minute from now.
# Run from C:\Duo Game:   .\scripts\test-rounds.ps1            (3-minute rounds)
#                         .\scripts\test-rounds.ps1 -Minutes 5 (5-minute rounds)
# When you're done:       .\scripts\event-rounds.ps1          (back to the real Oct 22 times)
param([int]$Minutes = 3)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:GOOGLE_APPLICATION_CREDENTIALS = Join-Path (Get-Location) "key.json"
$t = Get-Date
function At([int]$m) { $t.AddMinutes($m).ToString("HH:mm") }
$g = $Minutes + 1
$r = "$(At 1)-$(At (1 + $Minutes)),$(At (1 + $g))-$(At (1 + $g + $Minutes)),$(At (1 + 2 * $g))-$(At (1 + 2 * $g + $Minutes))"
Write-Host "TEST rounds today: $r" -ForegroundColor Yellow
npx tsx scripts/oneDayEvent.ts --prod --project decade-hunt-66f6e --date $t.ToString("yyyy-MM-dd") --rounds $r
Write-Host "Done. Refresh the app. When finished testing run: .\scripts\event-rounds.ps1" -ForegroundColor Yellow
