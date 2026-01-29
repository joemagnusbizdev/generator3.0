#!/usr/bin/env pwsh
$adminSecret = "88fff1a2f7e90f9f284698d151dd8b6c4d5dd1c6bfa0044413d8076fbf37b185"
$jobId = "9c984c5b-cc01-4fbc-a5b2-4721ecce768e"

# Test unlock endpoint
Write-Host "Testing unlock endpoint..."
$unlockUri = "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/scour/unlock?jobId=$jobId"

try {
    $unlockResponse = Invoke-RestMethod -Uri $unlockUri -Method POST `
      -Headers @{"Authorization"="Bearer $adminSecret"} `
      -Body '{}' `
      -ContentType "application/json" -SkipHttpErrorCheck
    Write-Host "Unlock response: $unlockResponse"
} catch {
    Write-Host "Unlock error: $_"
}

# Test status endpoint  
Write-Host "`nTesting status endpoint..."
$statusUri = "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/scour/status?jobId=$jobId"

try {
    $statusResponse = Invoke-RestMethod -Uri $statusUri -Method GET
    Write-Host "Status response: $statusResponse"
} catch {
    Write-Host "Status error: $_"
}
