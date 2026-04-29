param()

# Compare key names (not values) of .env vs .env.example
function Get-Keys($path) {
    if (-not (Test-Path $path)) { return @() }
    Get-Content $path |
        Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*\s*=' } |
        ForEach-Object { ($_ -split '=', 2)[0].Trim() }
}

$envKeys = Get-Keys '.env'
$exampleKeys = Get-Keys '.env.example'

Write-Host '--- Keys in .env ---' -ForegroundColor Cyan
$envKeys | ForEach-Object { Write-Host "  $_" }

Write-Host ''
Write-Host '--- Missing in .env (present in .env.example) ---' -ForegroundColor Yellow
$missing = $exampleKeys | Where-Object { $envKeys -notcontains $_ }
if ($missing) { $missing | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  (none)' }

Write-Host ''
Write-Host '--- Extra in .env (not in .env.example) ---' -ForegroundColor Yellow
$extra = $envKeys | Where-Object { $exampleKeys -notcontains $_ }
if ($extra) { $extra | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  (none)' }

Write-Host ''
Write-Host '--- Empty / placeholder values in .env ---' -ForegroundColor Yellow
$bad = @()
Get-Content '.env' | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $k = $Matches[1]; $v = $Matches[2].Trim().Trim('"').Trim("'")
        if ([string]::IsNullOrWhiteSpace($v) -or $v -match '^(your_|placeholder|changeme|xxx)' ) {
            $bad += $k
        }
    }
}
if ($bad) { $bad | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  (none)' }

Write-Host ''
Write-Host '--- Length sanity (mask values) ---' -ForegroundColor Cyan
Get-Content '.env' | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $k = $Matches[1]; $v = $Matches[2].Trim().Trim('"').Trim("'")
        $len = $v.Length
        $preview = if ($len -ge 6) { $v.Substring(0, [Math]::Min(4, $len)) + '...(' + $len + ' chars)' } else { '(' + $len + ' chars)' }
        Write-Host ("  {0,-45} {1}" -f $k, $preview)
    }
}
