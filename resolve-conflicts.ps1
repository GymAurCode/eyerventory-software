$files = @(
  "frontend/src/components/icons/SidebarIcons.jsx",
  "frontend/src/components/AppSidebar.jsx",
  "frontend/src/components/UI.jsx",
  "frontend/src/config/navigation.js",
  "frontend/src/pages/hr/EmployeesPage.jsx",
  "frontend/src/pages/AIIntelligencePage.jsx",
  "frontend/src/pages/CreditManagementPage.jsx",
  "frontend/src/pages/FinancePage.jsx",
  "frontend/src/pages/ProductsPage.jsx",
  "frontend/src/pages/PurchasesPage.jsx",
  "frontend/src/pages/SalesPage.jsx",
  "frontend/src/pages/SettingsPage.jsx"
)

foreach ($file in $files) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $inConflict = $false
    $keepLines = @()
    $lines = $content -split "`n"
    
    foreach ($line in $lines) {
      if ($line -match "^<<<<<<< HEAD") {
        $inConflict = "head"
        continue
      }
      if ($line -match "^=======") {
        $inConflict = "theirs"
        continue
      }
      if ($line -match "^>>>>>>> ") {
        $inConflict = $false
        continue
      }
      
      # Keep HEAD version, skip theirs
      if ($inConflict -eq "head" -or $inConflict -eq $false) {
        $keepLines += $line
      }
    }
    
    $newContent = $keepLines -join "`n"
    Set-Content -Path $file -Value $newContent -NoNewline
    Write-Host "Resolved: $file"
  }
}

Write-Host "`nAll conflicts resolved!"
