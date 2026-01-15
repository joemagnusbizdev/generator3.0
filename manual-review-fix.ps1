# MAGNUS Intelligence - Manual Review Tab Fix
# Use this if the automated script fails

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MANUAL FIX - Review Tab Component        " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$projectDir = "C:\Users\Joe Serkin\Documents\GitHub\generator3.0"
$componentPath = "$projectDir\src1\components\AlertReviewQueueInline.tsx"

Write-Host "FILE LOCATION:" -ForegroundColor Yellow
Write-Host "  $componentPath" -ForegroundColor White
Write-Host ""

Write-Host "INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "  1. Download the fixed component:" -ForegroundColor White
Write-Host "     https://www.genspark.ai/api/files/user-data/outputs/AlertReviewQueueInline-FIXED.tsx" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Replace the file at:" -ForegroundColor White
Write-Host "     $componentPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Build the project:" -ForegroundColor White
Write-Host "     cd `"$projectDir`"" -ForegroundColor Cyan
Write-Host "     npm run build" -ForegroundColor Cyan
Write-Host ""
Write-Host "  4. Run the dev server:" -ForegroundColor White
Write-Host "     npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  5. Test in browser:" -ForegroundColor White
Write-Host "     http://localhost:5173 -> Review tab" -ForegroundColor Cyan
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Ask user if they want to see the component content
$response = Read-Host "Do you want to see the fixed component code? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host ""
    Write-Host "FIXED COMPONENT CODE:" -ForegroundColor Yellow
    Write-Host "Copy this entire code block into: $componentPath" -ForegroundColor White
    Write-Host ""
    Write-Host "---------- START OF FILE ----------" -ForegroundColor Cyan
    
    $componentCode = Get-Content "/mnt/user-data/outputs/AlertReviewQueueInline-FIXED.tsx" -Raw
    Write-Host $componentCode -ForegroundColor White
    
    Write-Host "----------- END OF FILE -----------" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "KEY FIXES:" -ForegroundColor Yellow
Write-Host "  - Correct endpoint URL (full Supabase function path)" -ForegroundColor Green
Write-Host "  - Proper authentication with session token" -ForegroundColor Green
Write-Host "  - Correct response parsing (data.alerts)" -ForegroundColor Green
Write-Host "  - Added error handling and retry" -ForegroundColor Green
Write-Host "  - Added filters and refresh button" -ForegroundColor Green
Write-Host ""

Write-Host "EXPECTED RESULT:" -ForegroundColor Yellow
Write-Host "  Review tab will show all 44 alerts with:" -ForegroundColor White
Write-Host "  - Title, summary, location" -ForegroundColor White
Write-Host "  - Severity badges (critical, warning, etc.)" -ForegroundColor White
Write-Host "  - Event dates and AI info" -ForegroundColor White
Write-Host "  - Action buttons (Approve, Edit, Reject, Source)" -ForegroundColor White
Write-Host "  - Filters for severity and country" -ForegroundColor White
Write-Host ""

Write-Host "If you still have issues after deploying, run this diagnostic:" -ForegroundColor Yellow
Write-Host ""
Write-Host @"
// Paste this in browser console (F12):
(async () => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    console.error('Not logged in!');
    return;
  }
  
  const token = data.session.access_token;
  const response = await fetch(
    'https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts/review',
    { headers: { 'Authorization': 'Bearer ' + token } }
  );
  
  const result = await response.json();
  console.log('Status:', response.status);
  console.log('Alerts:', result.alerts?.length || 0);
  console.table(result.alerts?.slice(0, 5).map(a => ({
    title: a.title.substring(0, 40),
    country: a.country,
    severity: a.severity
  })));
})();
"@ -ForegroundColor Cyan

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Ready to fix? Follow the steps above!    " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
