# Resize downloaded photos to 640px JPEG q80 into images/mountains (ASCII-only)
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $env:TEMP "mtphotos2"
$outDir = Join-Path $root "images\mountains"
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]80)
$ok = 0; $fail = 0; $total = 0
foreach ($f in Get-ChildItem $srcDir -Filter *.jpg) {
  $dest = Join-Path $outDir $f.Name
  if (Test-Path $dest) { continue }
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $scale = [Math]::Min(1.0, 640.0 / [Math]::Max($img.Width, $img.Height))
    $w = [Math]::Max(1, [int]($img.Width * $scale)); $h = [Math]::Max(1, [int]($img.Height * $scale))
    $bmp = New-Object System.Drawing.Bitmap([int]$w, [int]$h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose()
    $bmp.Save($dest, $enc, $ep)
    $bmp.Dispose(); $img.Dispose()
    $ok++; $total += (Get-Item $dest).Length
  } catch { $fail++; Write-Output "RESIZE-FAIL $($f.Name): $($_.Exception.Message)" }
}
Write-Output "RESIZED ok=$ok fail=$fail addedKB=$([int]($total/1024)) totalFiles=$((Get-ChildItem $outDir).Count)"
