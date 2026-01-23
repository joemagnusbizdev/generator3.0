<#
import_sources_bulk.ps1

Usage:
  # set env vars first (recommended: use service_role key)
  $env:SUPABASE_URL = 'https://<project>.supabase.co'
  $env:SUPABASE_KEY = '<service_role_or_api_key>'

  # run (defaults to sources_replace.csv in repo root)
  .\scripts\import_sources_bulk.ps1 -CsvPath .\sources_replace.csv

What it does:
  - Reads a CSV with headers: name,url,country
  - Converts rows to JSON objects and POSTs them to the Supabase REST endpoint `/rest/v1/sources`
  - Sends inserts in chunks and uses `Prefer: resolution=merge-duplicates` to upsert by unique constraints

Notes:
  - Use a Supabase service_role key for full write/delete permissions.
  - Adjust chunk size or add extra fields (type, trust_score, enabled) as needed.
#>

param(
  [string]$CsvPath = "sources_replace.csv",
  [int]$ChunkSize = 50
)

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_KEY) {
  Write-Error "Please set SUPABASE_URL and SUPABASE_KEY environment variables before running."
  exit 1
}

if (-not (Test-Path $CsvPath)) {
  Write-Error "CSV file not found: $CsvPath"
  exit 1
}

$url = "$($env:SUPABASE_URL.TrimEnd('/'))/rest/v1/sources"

Write-Host "Reading CSV: $CsvPath"
$rows = Import-Csv -Path $CsvPath
if ($rows.Count -eq 0) { Write-Host "No rows found in CSV."; exit 0 }

$items = @()
foreach ($r in $rows) {
  $name = $r.name
  $urlField = $r.url
  $country = $r.country
  if (-not $urlField) { Write-Warning "Skipping row with missing url: $($r | Out-String)"; continue }
  $obj = @{ name = $name; url = $urlField; country = $country; enabled = $true; trust_score = 0.5; created_at = (Get-Date).ToString('o'); updated_at = (Get-Date).ToString('o') }
  $items += $obj
}

Function Post-Chunk($chunk) {
  $json = $chunk | ConvertTo-Json -Depth 5
  $headers = @{
    "apikey" = $env:SUPABASE_KEY
    "Authorization" = "Bearer $($env:SUPABASE_KEY)"
    "Content-Type" = "application/json"
    "Prefer" = "resolution=merge-duplicates"
  }
  try {
    $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $json -ErrorAction Stop
    Write-Host "Posted chunk of $($chunk.Count) rows."
  } catch {
    Write-Error "Failed to post chunk: $($_.Exception.Message)"
    Write-Host "Server response (if any): $($_.ErrorDetails)"
  }
}

$i = 0
while ($i -lt $items.Count) {
  $chunk = $items[$i..([Math]::Min($i + $ChunkSize - 1, $items.Count - 1))]
  Post-Chunk $chunk
  $i += $ChunkSize
  Start-Sleep -Milliseconds 200
}

Write-Host "Import complete. Verify in Supabase: SELECT id,name,url,enabled FROM sources ORDER BY name;"
