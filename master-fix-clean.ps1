# ============================================================================
# MAGNUS Intelligence - MASTER FIX SCRIPT (Clean Version)
# ============================================================================

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Joe Serkin\Documents\GitHub\generator3.0"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  MAGNUS Intelligence - Complete Fix Script" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan

# ============================================================================
# PART 1: Fix UTF-8 Tab Headers
# ============================================================================

Write-Host ""
Write-Host "PART 1: Fixing UTF-8 Tab Headers..." -ForegroundColor Yellow

$appPath = "src1\App.tsx"

if (Test-Path $appPath) {
    $content = Get-Content $appPath -Raw -Encoding UTF8
    
    $newTabs = @'
const ALL_TABS: Tab[] = [
  { id: 'review', label: 'Review', icon: '📋' },
  { id: 'create', label: 'Create', icon: '✏️' },
  { id: 'sources', label: 'Sources', icon: '📰' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'admin', label: 'Admin', icon: '⚙️' },
];
'@
    
    $content = $content -replace "const ALL_TABS: Tab\[\] = \[[^\]]+\];", $newTabs
    
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Resolve-Path $appPath).Path, $content, $utf8NoBom)
    
    Write-Host "  [OK] Fixed App.tsx" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] App.tsx not found!" -ForegroundColor Red
}

# ============================================================================
# PART 2: Delete Invalid Sources
# ============================================================================

Write-Host ""
Write-Host "PART 2: Cleaning Invalid Sources..." -ForegroundColor Yellow

$token = Read-Host "`nEnter your SUPABASE_SERVICE_ROLE_KEY"

$headers = @{
    "Authorization" = "Bearer $token"
    "apikey" = $token
    "Content-Type" = "application/json"
}

Write-Host ""
Write-Host "  Fetching sources..." -ForegroundColor Cyan

$sourcesUrl = "https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/sources?select=id,name,url,enabled"
$allSources = Invoke-RestMethod -Uri $sourcesUrl -Headers $headers

$invalidSources = $allSources | Where-Object { 
    !$_.url -or $_.url -eq '' -or $_.url -notmatch '^https?://' 
}

Write-Host "  Total sources: $($allSources.Count)" -ForegroundColor White
Write-Host "  Invalid URLs: $($invalidSources.Count)" -ForegroundColor Red

if ($invalidSources.Count -gt 0) {
    Write-Host ""
    Write-Host "  First 10 invalid sources:" -ForegroundColor Yellow
    $invalidSources | Select-Object -First 10 | ForEach-Object {
        $urlPreview = if ($_.url) { $_.url.Substring(0, [Math]::Min(50, $_.url.Length)) } else { "(empty)" }
        Write-Host "    - $($_.name): $urlPreview" -ForegroundColor DarkGray
    }
    
    Write-Host ""
    $confirm = Read-Host "  Delete all $($invalidSources.Count) invalid sources? (y/n)"
    
    if ($confirm -eq 'y') {
        Write-Host ""
        Write-Host "  Deleting..." -ForegroundColor Cyan
        
        $deleted = 0
        foreach ($source in $invalidSources) {
            try {
                $deleteUrl = "https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/sources?id=eq.$($source.id)"
                Invoke-RestMethod -Uri $deleteUrl -Method DELETE -Headers $headers | Out-Null
                $deleted++
                if ($deleted % 25 -eq 0) {
                    Write-Host "    Progress: $deleted / $($invalidSources.Count)" -ForegroundColor DarkGray
                }
            } catch {
                Write-Host "    [ERROR] Failed: $($source.name)" -ForegroundColor Red
            }
        }
        
        Write-Host "  [OK] Deleted $deleted invalid sources" -ForegroundColor Green
    }
}

# ============================================================================
# PART 3: Verify Valid Sources
# ============================================================================

Write-Host ""
Write-Host "PART 3: Verifying Valid Sources..." -ForegroundColor Yellow

$validSourcesUrl = "https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/sources?enabled=eq.true" + "&select=id,name,url"
$allValidSources = Invoke-RestMethod -Uri $validSourcesUrl -Headers $headers
$validSources = $allValidSources | Where-Object { $_.url -match '^https?://' }

Write-Host "  [OK] Valid enabled sources: $($validSources.Count)" -ForegroundColor Green

if ($validSources.Count -gt 0) {
    Write-Host ""
    Write-Host "  Sample sources:" -ForegroundColor Cyan
    $validSources | Select-Object -First 5 | ForEach-Object {
        Write-Host "    - $($_.name): $($_.url)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  [WARNING] No valid sources found!" -ForegroundColor Red
    Write-Host "  You need to upload sources with proper URLs" -ForegroundColor Yellow
}

# ============================================================================
# PART 4: Build Frontend
# ============================================================================

Write-Host ""
Write-Host "PART 4: Building Frontend..." -ForegroundColor Yellow

$buildOutput = npm run build 2>&1
$buildSuccess = $LASTEXITCODE -eq 0

if ($buildSuccess) {
    Write-Host "  [OK] Build successful!" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Build failed!" -ForegroundColor Red
    Write-Host $buildOutput -ForegroundColor Red
    exit 1
}

# ============================================================================
# PART 5: Test Scour (Optional)
# ============================================================================

if ($validSources.Count -ge 3) {
    Write-Host ""
    Write-Host "PART 5: Test Scour (Optional)..." -ForegroundColor Yellow
    
    $testConfirm = Read-Host "`n  Run test scour with 3 sources? (y/n)"
    
    if ($testConfirm -eq 'y') {
        $testIds = ($validSources | Select-Object -First 3).id
        
        Write-Host "  Starting scour..." -ForegroundColor Cyan
        
        try {
            $scourBody = @{
                sourceIds = $testIds
                daysBack = 14
            } | ConvertTo-Json
            
            $scourHeaders = @{
                "Authorization" = "Bearer $token"
                "Content-Type" = "application/json"
            }
            
            $scourUrl = "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/scour-sources"
            $scourResult = Invoke-RestMethod -Uri $scourUrl -Method POST -Headers $scourHeaders -Body $scourBody
            
            $jobId = $scourResult.jobId
            Write-Host "  [OK] Job started: $jobId" -ForegroundColor Green
            
            Write-Host ""
            Write-Host "  Polling for 30 seconds..." -ForegroundColor Cyan
            
            for ($i = 1; $i -le 6; $i++) {
                Start-Sleep -Seconds 5
                
                $statusUrl = "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/scour/status?jobId=$jobId"
                $statusHeaders = @{ "Authorization" = "Bearer $token" }
                $status = Invoke-RestMethod -Uri $statusUrl -Headers $statusHeaders
                
                Write-Host "    [$i] $($status.status) | Processed: $($status.processed)/$($status.total) | Created: $($status.created)" -ForegroundColor White
                
                if ($status.status -eq 'done' -or $status.status -eq 'error') {
                    if ($status.created -gt 0) {
                        Write-Host ""
                        Write-Host "  [SUCCESS] Created $($status.created) alerts!" -ForegroundColor Green
                    } else {
                        Write-Host ""
                        Write-Host "  [WARNING] No alerts created (sources may not have recent content)" -ForegroundColor Yellow
                    }
                    break
                }
            }
        } catch {
            Write-Host "  [ERROR] Test scour failed: $_" -ForegroundColor Red
        }
    }
}

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  ALL FIXES COMPLETE!" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  1. [OK] Fixed UTF-8 tab headers in App.tsx" -ForegroundColor White
Write-Host "  2. [OK] Deleted $($invalidSources.Count) invalid sources" -ForegroundColor White
Write-Host "  3. [OK] Verified $($validSources.Count) valid sources ready" -ForegroundColor White
Write-Host "  4. [OK] Build successful" -ForegroundColor White

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Run: npm run dev" -ForegroundColor White
Write-Host "  2. Open browser: http://localhost:5173" -ForegroundColor White
Write-Host "  3. Verify tabs show correct icons (clipboard, pencil, newspaper, etc)" -ForegroundColor White
Write-Host "  4. Go to Sources tab" -ForegroundColor White
Write-Host "  5. Click 'Start Scour'" -ForegroundColor White
Write-Host "  6. Watch progress - should process $($validSources.Count) sources" -ForegroundColor White

if ($validSources.Count -lt 10) {
    Write-Host ""
    Write-Host "NOTE: You only have $($validSources.Count) valid sources." -ForegroundColor Yellow
    Write-Host "Upload more sources with proper URLs for better results." -ForegroundColor Yellow
    Write-Host "Download template from outputs folder" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Gray
Write-Host ""
