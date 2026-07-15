# Fetch climber bios (ja/en extracts) + portrait thumbnails from Wikipedia (ASCII-only)
$ErrorActionPreference = "SilentlyContinue"
$manifest = ([System.IO.File]::ReadAllText((Join-Path $PSScriptRoot "climbers-manifest.json")) | ConvertFrom-Json).entries
$outDir = Join-Path $env:TEMP "climbers"
New-Item -ItemType Directory -Force $outDir | Out-Null
$ua = @{ "User-Agent" = "MountainPeakDemoBot/1.0 (contact: jiantailanglin266@gmail.com)" }
$i = 0; $ok = 0; $noJa = 0; $noImg = 0
foreach ($e in $manifest) {
  $i++
  $jsonPath = Join-Path $outDir "$($e.id).json"
  if (Test-Path $jsonPath) { $ok++; continue }
  $rec = @{ id = $e.id; extractJa = ""; extractEn = ""; urlJa = ""; urlEn = ""; img = $false }
  $thumbUrl = $null
  if ($e.wikiJa) {
    Start-Sleep -Milliseconds 2600
    try {
      $enc = [uri]::EscapeDataString(($e.wikiJa -replace " ", "_"))
      $j = Invoke-RestMethod -Uri "https://ja.wikipedia.org/api/rest_v1/page/summary/$enc" -TimeoutSec 25 -Headers $ua
      if ($j.extract) { $rec.extractJa = $j.extract; $rec.urlJa = $j.content_urls.desktop.page }
      if ($j.thumbnail.source) { $thumbUrl = $j.thumbnail.source }
    } catch { if ("$($_.Exception.Message)" -match "429") { Start-Sleep -Seconds 20 } }
  }
  if ($e.wikiEn) {
    Start-Sleep -Milliseconds 2600
    try {
      $enc = [uri]::EscapeDataString(($e.wikiEn -replace " ", "_"))
      $j = Invoke-RestMethod -Uri "https://en.wikipedia.org/api/rest_v1/page/summary/$enc" -TimeoutSec 25 -Headers $ua
      if ($j.extract) { $rec.extractEn = $j.extract; $rec.urlEn = $j.content_urls.desktop.page }
      if (-not $thumbUrl -and $j.thumbnail.source) { $thumbUrl = $j.thumbnail.source }
    } catch { if ("$($_.Exception.Message)" -match "429") { Start-Sleep -Seconds 20 } }
  }
  if ($thumbUrl -and ($thumbUrl -notmatch "svg")) {
    Start-Sleep -Milliseconds 1500
    try {
      Invoke-WebRequest -Uri $thumbUrl -OutFile (Join-Path $outDir "$($e.id).img") -TimeoutSec 60 -Headers $ua -UseBasicParsing
      if ((Get-Item (Join-Path $outDir "$($e.id).img")).Length -gt 2000) { $rec.img = $true }
    } catch {}
  }
  if (-not $rec.img) { $noImg++ }
  if (-not $rec.extractJa) { $noJa++ }
  [System.IO.File]::WriteAllText($jsonPath, ($rec | ConvertTo-Json -Compress))
  if ($rec.extractJa -or $rec.extractEn) { $ok++ }
  if ($i % 25 -eq 0) { Write-Output "progress: $i/$($manifest.Count) ok=$ok noImg=$noImg" }
}
Write-Output "DONE total=$($manifest.Count) ok=$ok noJa=$noJa noImg=$noImg"
