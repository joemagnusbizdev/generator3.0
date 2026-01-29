# Force clear all scour jobs from KV
$uri = "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/force-stop-scour"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2JueXplemt1eXB0dWFrenRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3MjUwNDksImV4cCI6MjA1MjMwMTA0OX0.HEcwbUhJVNgODj_N4u-xn-z4EsKHp1yxQp4pJRQ1YlA"

Write-Host "Forcing stop of all scour jobs..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } -TimeoutSec 30

    Write-Host "✓ Success: $($response.message)" -ForegroundColor Green
    Write-Host "Deleted: $($response.deleted) job(s)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
