# Test Brave Search API manually
# Get the API key from Supabase secrets

$BraveApiKey = & npx supabase secrets list | Select-String "BRAVRE_SEARCH_API_KEY" | % { $_.Line -split '\|' | % { $_.Trim() } }
Write-Host "API Key Hash Found in secrets"

# Get the actual value from environment if available
# For now, we'll check if the key is accessible from the edge function

# Make a request to trigger early signals manually
$Response = Invoke-WebRequest `
  -Uri "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/scour/early-signals" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"jobId":"manual-test"}' `
  -Headers @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2JueXplemtfeXB0dWFrenRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDIzOTAzNzEsImV4cCI6MTkwMjM5MDM3MX0.example"  # Replace with actual anon key
  }

Write-Host "Response Status: $($Response.StatusCode)"
Write-Host "Response: $($Response.Content)"
