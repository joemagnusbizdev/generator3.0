# Remove Reddit sources via Supabase REST API
# This script deletes all Reddit sources from the sources table

$ErrorActionPreference = "Stop"

Write-Host "`n🔴 Removing Reddit sources from Supabase..." -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Configuration
$SUPABASE_URL = "https://gnobnyzezkuyptuakztf.supabase.co"
$SERVICE_KEY = Read-Host "Enter your SUPABASE_SERVICE_ROLE_KEY"

if (-not $SERVICE_KEY) {
    Write-Host "Error: Service key required" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $SERVICE_KEY"
    "apikey" = $SERVICE_KEY
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

# Step 1: Get count of Reddit sources
Write-Host "`n📊 Checking for Reddit sources..." -ForegroundColor Yellow

try {
    $redditSources = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/sources?or=(type.eq.reddit,name.ilike.*Reddit*)" `
        -Headers $headers `
        -Method GET
    
    $count = if ($redditSources -is [array]) { $redditSources.Count } else { 1 }
    Write-Host "  Found $count Reddit sources" -ForegroundColor Green
    
    if ($count -eq 0) {
        Write-Host "`n✅ No Reddit sources to remove" -ForegroundColor Green
        exit 0
    }
    
    # Show sample
    Write-Host "`n  Sample sources:" -ForegroundColor Gray
    $redditSources | Select-Object -First 5 | ForEach-Object {
        Write-Host "    - $($_.name)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "  ❌ Error fetching sources: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Confirm deletion
Write-Host "`n⚠️  About to delete $count Reddit sources" -ForegroundColor Yellow
$confirm = Read-Host "Continue? (y/n)"

if ($confirm -ne 'y') {
    Write-Host "Cancelled" -ForegroundColor Yellow
    exit 0
}

# Step 3: Delete Reddit sources
Write-Host "`n🗑️  Deleting Reddit sources..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/sources?or=(type.eq.reddit,name.ilike.*Reddit*)" `
        -Headers $headers `
        -Method DELETE
    
    Write-Host "  ✅ Successfully deleted $count Reddit sources" -ForegroundColor Green
    
} catch {
    Write-Host "  ❌ Error deleting sources: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Verify deletion
Write-Host "`n✔️  Verifying deletion..." -ForegroundColor Yellow

try {
    $remaining = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/sources?or=(type.eq.reddit,name.ilike.*Reddit*)" `
        -Headers $headers `
        -Method GET
    
    $remainingCount = if ($remaining -is [array]) { $remaining.Count } else { if ($remaining) { 1 } else { 0 } }
    
    if ($remainingCount -eq 0) {
        Write-Host "  ✅ Verified: All Reddit sources removed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Warning: $remainingCount sources still remain" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "  ❌ Error verifying deletion: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" -ForegroundColor Gray
Write-Host "Complete!" -ForegroundColor Green
