# Trigger Early Signals Re-run to recover failed alerts

$supabaseUrl = "https://gnobnyzezkuyptuakztf.supabase.co"
$supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2JueXplemtrdXlwdHVha3p0ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjk0NjQ1NzUxLCJleHAiOjE5NzA0MjE3NTF9.PXmWRg5F3CFqLZF3vGLfKLLCOJ5bVPDrWJRwh-WyxJo"

$endpoint = "$supabaseUrl/functions/v1/clever-function/scour/early-signals"

Write-Host "🚀 Triggering Early Signals Re-run..." -ForegroundColor Cyan
Write-Host "📍 Endpoint: $endpoint" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest `
        -Uri $endpoint `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $supabaseAnonKey"
            "Content-Type" = "application/json"
        } `
        -Body "{}" `
        -UseBasicParsing

    $body = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "📋 Response:" -ForegroundColor Cyan
    Write-Host ($body | ConvertTo-Json) -ForegroundColor White
    
    Write-Host "`n⏳ Early signals are now running in the background..." -ForegroundColor Yellow
    Write-Host "💡 Tip: Check Supabase logs to monitor progress" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
