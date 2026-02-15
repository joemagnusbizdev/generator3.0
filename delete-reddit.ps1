#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$headers = @{
    "Authorization" = "Bearer a2c2ccfcd362ba06552626977cc0575312916141d6f880f9b5acee9c4353cfd7"
    "apikey" = "a2c2ccfcd362ba06552626977cc0575312916141d6f880f9b5acee9c4353cfd7"
    "Content-Type" = "application/json"
}

$url = "https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/sources?or=(type.eq.reddit,name.ilike.*Reddit*)"

Write-Host "`n🔴 Removing Reddit sources..." -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host "`nFetching Reddit sources..." -ForegroundColor Yellow
$sources = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
$count = if ($sources -is [array]) { $sources.Count } else { if ($sources) { 1 } else { 0 } }
Write-Host "  Found $count Reddit sources" -ForegroundColor Yellow

if ($count -eq 0) {
    Write-Host "`n✅ No Reddit sources to remove" -ForegroundColor Green
    exit 0
}

# Delete them
Write-Host "`nDeleting Reddit sources..." -ForegroundColor Yellow
$result = Invoke-RestMethod -Uri $url -Headers $headers -Method DELETE
Write-Host "  ✅ Successfully deleted $count sources" -ForegroundColor Green

# Verify
Write-Host "`nVerifying deletion..." -ForegroundColor Yellow
$remaining = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
$remainingCount = if ($remaining -is [array]) { $remaining.Count } else { if ($remaining) { 1 } else { 0 } }
Write-Host "  ✔️  $remainingCount Reddit sources remaining" -ForegroundColor Green

Write-Host "`nDone!`n" -ForegroundColor Green
