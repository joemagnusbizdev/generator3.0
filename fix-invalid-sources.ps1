# ============================================================================
# MAGNUS Intelligence - Fix Invalid Source URLs
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "`n🔧 MAGNUS Intelligence - Source URL Fix Script" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Get your service key
$token = Read-Host "`nEnter your SUPABASE_SERVICE_ROLE_KEY"

$headers = @{
    "Authorization" = "Bearer $token"
    "apikey" = $token
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

Write-Host "`n📊 STEP 1: Analyzing sources..." -ForegroundColor Yellow

# Fetch all sources
try {
    $allSources = Invoke-RestMethod -Uri "https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/sources?select=id,name,url,enabled" -Headers $headers
    Write-Host "  ✅ Fetched $($allSources.Count) total sources" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to fetch sources: $_" -ForegroundColor Red
    exit 1
}

# Categorize sources
$validSources = $allSources | Where-Object { $_.url -match '^https?://' }
$invalidSources = $allSources | Where-Object { $_.url -notmatch '^https?://' -or $_.url -eq $null -or $_.url -eq '' }
$invalidEnabled = $invalidSources | Where-Object { $_.enabled -eq $true }

Write-Host "`n📈 Statistics:" -ForegroundColor Cyan
Write-Host "  Total sources: $($allSources.Count)" -ForegroundColor White
Write-Host "  ✅ Valid URLs: $($validSources.Count)" -ForegroundColor Green
Write-Host "  ❌ Invalid URLs: $($invalidSources.Count)" -ForegroundColor Red
Write-Host "  ⚠️  Invalid & Enabled: $($invalidEnabled.Count)" -ForegroundColor Yellow

if ($invalidEnabled.Count -eq 0) {
    Write-Host "`n✅ All enabled sources have valid URLs!" -ForegroundColor Green
    Write-Host "`nNo action needed. You can run scour now." -ForegroundColor White
    exit 0
}

Write-Host "`n📋 Invalid sources that are currently ENABLED:" -ForegroundColor Yellow
$invalidEnabled | Select-Object -First 20 | ForEach-Object {
    Write-Host "  • $($_.name): '$($_.url)'" -ForegroundColor DarkGray
}

if ($invalidEnabled.Count -gt 20) {
    Write-Host "  ... and $($invalidEnabled.Count - 20) more" -ForegroundColor DarkGray
}

Write-Host "`n🔧 STEP 2: Disable invalid sources" -ForegroundColor Yellow
Write-Host "This will disable $($invalidEnabled.Count) sources with invalid URLs." -ForegroundColor White
$confirm = Read-Host "Continue? (y/n)"

if ($confirm -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n⏳ Disabling invalid sources..." -ForegroundColor Cyan

$disabledCount = 0
foreach ($source in $invalidEnabled) {
    try {
        $body = @{ enabled = $false } | ConvertTo-Json
        $null = Invoke-RestMethod -Uri "https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/sources?id=eq.$($source.id)" -Method PATCH -Headers $headers -Body $body
        $disabledCount++
        Write-Host "  ✓ Disabled: $($source.name)" -ForegroundColor DarkGray
    } catch {
        Write-Host "  ✗ Failed to disable $($source.name): $_" -ForegroundColor Red
    }
}

Write-Host "`n✅ Disabled $disabledCount sources" -ForegroundColor Green

Write-Host "`n📊 STEP 3: Current status" -ForegroundColor Yellow

# Re-fetch to verify
$updatedSources = Invoke-RestMethod -Uri "https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/sources?enabled=eq.true&select=id,name,url" -Headers $headers
$stillInvalid = $updatedSources | Where-Object { $_.url -notmatch '^https?://' }

Write-Host "  ✅ Enabled sources: $($updatedSources.Count)" -ForegroundColor Green
Write-Host "  ✅ Valid URLs: $($updatedSources.Count - $stillInvalid.Count)" -ForegroundColor Green
Write-Host "  ❌ Still invalid: $($stillInvalid.Count)" -ForegroundColor $(if ($stillInvalid.Count -gt 0) { 'Red' } else { 'Green' })

if ($stillInvalid.Count -eq 0) {
    Write-Host "`n🎉 SUCCESS! All enabled sources now have valid URLs." -ForegroundColor Green
    Write-Host "`n🚀 Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Run: npm run dev" -ForegroundColor White
    Write-Host "  2. Go to Sources tab" -ForegroundColor White
    Write-Host "  3. Click 'Start Scour'" -ForegroundColor White
    Write-Host "  4. Watch the progress - should see actual scraping now!" -ForegroundColor White
} else {
    Write-Host "`n⚠️  Some invalid sources are still enabled." -ForegroundColor Yellow
    Write-Host "Manual review required for:" -ForegroundColor White
    $stillInvalid | ForEach-Object {
        Write-Host "  • $($_.name): '$($_.url)'" -ForegroundColor DarkGray
    }
}

Write-Host "`n📥 STEP 4: Upload corrected sources" -ForegroundColor Yellow
Write-Host "A corrected sources CSV template has been created for you." -ForegroundColor White
Write-Host "Download it from: https://www.genspark.ai/api/files/user-data/outputs/sources-corrected.csv" -ForegroundColor Cyan
Write-Host "`nThis file contains proper URLs for common news sources." -ForegroundColor White
Write-Host "Upload it via: Sources tab → Bulk Upload → Choose File" -ForegroundColor White

Write-Host "`n" + ("=" * 60) -ForegroundColor Gray
Write-Host "✅ Script complete!" -ForegroundColor Green
