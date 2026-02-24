$token = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc"
$denoBotUrl = "https://generator30.joemagnusbizdev.deno.net"

Write-Host "Checking current webhook..."
$checkUrl = "https://api.telegram.org/bot$token/getWebhookInfo"
$check = Invoke-WebRequest -Uri $checkUrl -UseBasicParsing
$currentWebhook = ($check.Content | ConvertFrom-Json).result.url
Write-Host "Current: $currentWebhook"

write-Host "Deleting webhook..."
$deleteUrl = "https://api.telegram.org/bot$token/deleteWebhook"
Invoke-WebRequest -Uri $deleteUrl -UseBasicParsing | Out-Null
Start-Sleep -Seconds 2

Write-Host "Setting to Deno Deploy: $denoBotUrl"
$setUrl = "https://api.telegram.org/bot$token/setWebhook?url=$denoBotUrl"
$result = Invoke-WebRequest -Uri $setUrl -UseBasicParsing
Write-Host "Result: " ($result.Content | ConvertFrom-Json | Select-Object ok, description)

Write-Host "Verifying..."
$verify = Invoke-WebRequest -Uri $checkUrl -UseBasicParsing
$newWebhook = ($verify.Content | ConvertFrom-Json).result.url
Write-Host "New webhook: $newWebhook"
