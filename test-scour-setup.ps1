# Test if Edge Function is properly configured
Write-Host "Testing Edge Function configuration..." -ForegroundColor Cyan

$headers = @{
    'Content-Type' = 'application/json'
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2JueXplemtreXB0dWFrenRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NzU4MjMsImV4cCI6MjA1MjU1MTgyM30.eUUvNJqfzwM5UWDmKjl62iFtRJM3CHNDS0DNHIR_u5w'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2JueXplemtreXB0dWFrenRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NzU4MjMsImV4cCI6MjA1MjU1MTgyM30.eUUvNJqfzwM5UWDmKjl62iFtRJM3CHNDS0DNHIR_u5w'
}

# Test 1: Check Edge Function is responding
Write-Host "`n1. Testing Edge Function response..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri 'https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/status' -Headers $headers -Method GET -ErrorAction Stop
    Write-Host "  ✓ Edge Function is responding" -ForegroundColor Green
    Write-Host "  Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Edge Function not responding: $_" -ForegroundColor Red
}

# Test 2: Check app_kv table exists
Write-Host "`n2. Testing app_kv table..." -ForegroundColor Yellow
$serviceHeaders = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2JueXplemtreXB0dWFrenRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjk3NTgyMywiZXhwIjoyMDUyNTUxODIzfQ.v3up5hr03AobM8ezinI0zAcOuqZEY6Y9ktv_yqwCig8'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2JueXplemtreXB0dWFrenRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjk3NTgyMywiZXhwIjoyMDUyNTUxODIzfQ.v3up5hr03AobM8ezinI0zAcOuqZEY6Y9ktv_yqwCig8'
}
try {
    $response = Invoke-RestMethod -Uri 'https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/app_kv?limit=1' -Headers $serviceHeaders -Method GET -ErrorAction Stop
    Write-Host "  ✓ app_kv table exists" -ForegroundColor Green
} catch {
    Write-Host "  ✗ app_kv table missing or inaccessible: $_" -ForegroundColor Red
    Write-Host "  Run migration: supabase db push" -ForegroundColor Yellow
}

# Test 3: Check for enabled sources
Write-Host "`n3. Testing enabled sources..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri 'https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/sources?enabled=eq.true&select=id,name&limit=5' -Headers $serviceHeaders -Method GET -ErrorAction Stop
    Write-Host "  ✓ Found $($response.Count) enabled sources (showing first 5)" -ForegroundColor Green
    $response | ForEach-Object { Write-Host "    - $($_.name)" -ForegroundColor Gray }
} catch {
    Write-Host "  ✗ Cannot access sources: $_" -ForegroundColor Red
}

# Test 4: Check recent alerts
Write-Host "`n4. Testing recent alerts..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri 'https://gnobnyzezkuyptuakztf.supabase.co/rest/v1/alerts?select=id,title,created_at,ai_generated&order=created_at.desc&limit=3' -Headers $serviceHeaders -Method GET -ErrorAction Stop
    if ($response.Count -gt 0) {
        Write-Host "  ✓ Found $($response.Count) recent alerts:" -ForegroundColor Green
        $response | ForEach-Object { 
            $aiStatus = if ($_.ai_generated) { "AI" } else { "Manual" }
            Write-Host "    - [$($_.created_at)] $($_.title) ($aiStatus)" -ForegroundColor Gray 
        }
    } else {
        Write-Host "  ! No alerts in database yet" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Cannot access alerts: $_" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. If app_kv is missing, run: supabase db push" -ForegroundColor White
Write-Host "2. Check Supabase Edge Function secrets have ANTHROPIC_API_KEY set" -ForegroundColor White
Write-Host "3. Try running scour from the UI" -ForegroundColor White
