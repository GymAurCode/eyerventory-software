# Resolve all git merge conflicts in backend Python/SQL files by keeping HEAD (ours)
$files = @(
  "backend/main.py",
  "backend/initDb.py",
  "backend/models/__init__.py",
  "backend/models/customer.py",
  "backend/models/product.py",
  "backend/models/purchase.py",
  "backend/models/sale.py",
  "backend/models/supplier.py",
  "backend/routes/accounting.py",
  "backend/routes/products.py",
  "backend/routes/purchases.py",
  "backend/schemas/credit.py",
  "backend/schemas/product.py",
  "backend/schemas/purchase.py",
  "backend/schemas/sale.py",
  "backend/services/purchase_service.py",
  "backend/services/sale_service.py"
)

foreach ($file in $files) {
  if (-not (Test-Path $file)) { Write-Host "SKIP (not found): $file"; continue }

  $raw = [System.IO.File]::ReadAllText($file)
  if ($raw -notmatch "<<<<<<< HEAD") { Write-Host "CLEAN: $file"; continue }

  $lines = $raw -split "`n"
  $out   = [System.Collections.Generic.List[string]]::new()
  $state = "normal"   # normal | head | theirs

  foreach ($line in $lines) {
    if ($line -match "^<<<<<<< HEAD") { $state = "head";   continue }
    if ($line -match "^=======")      { $state = "theirs"; continue }
    if ($line -match "^>>>>>>> ")     { $state = "normal"; continue }

    if ($state -eq "normal" -or $state -eq "head") {
      $out.Add($line)
    }
    # theirs lines are discarded
  }

  [System.IO.File]::WriteAllText($file, ($out -join "`n"))
  Write-Host "RESOLVED: $file"
}

Write-Host "`nDone."
