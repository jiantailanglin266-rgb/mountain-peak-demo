# Download mountain photos from Wikipedia (ASCII-only script; unicode lives in manifest JSON)
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$manifest = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot "photo-manifest.json")) | ConvertFrom-Json
$outDir = Join-Path $env:TEMP "mtphotos2"
New-Item -ItemType Directory -Force $outDir | Out-Null
$ua = "MountainPeakDemoBot/1.0 (contact: jiantailanglin266@gmail.com)"
$okCount = 0
$failList = @()
$i = 0
foreach ($entry in $manifest) {
  $i++
  $slug = $entry.slug
  $dest = Join-Path $outDir "$slug.jpg"
  if (Test-Path $dest) { $okCount++; continue }
  $got = $false
  foreach ($title in $entry.titles) {
    Start-Sleep -Seconds 3
    try {
      $enc = [uri]::EscapeDataString(($title -replace " ", "_"))
      $j = Invoke-RestMethod -Uri "https://$($entry.lang).wikipedia.org/api/rest_v1/page/summary/$enc" -TimeoutSec 25 -Headers @{ "User-Agent" = $ua }
      $url = $j.originalimage.source
      if (-not $url) { continue }
      if ($url -match "\.svg") { continue }
      Start-Sleep -Seconds 2
      Invoke-WebRequest -Uri $url -OutFile $dest -TimeoutSec 120 -Headers @{ "User-Agent" = $ua } -UseBasicParsing
      if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 5000)) { $got = $true; break }
      Remove-Item $dest -Force -ErrorAction SilentlyContinue
    } catch {
      if ("$($_.Exception.Message)" -match "429") { Start-Sleep -Seconds 20 }
    }
  }
  if ($got) { $okCount++ } else { $failList += $slug }
  if ($i % 20 -eq 0) { Write-Output "progress: $i/$($manifest.Count) ok=$okCount" }
}
Write-Output "DONE ok=$okCount fail=$($failList.Count)"
if ($failList.Count -gt 0) { Write-Output ("FAILED: " + ($failList -join ",")) }
