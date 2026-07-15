# Featured climber videos via YouTube search + oEmbed verification (ASCII-only)
$ErrorActionPreference = "SilentlyContinue"
$queries = @(
  @{ key = "Reinhold Messner"; q = "Reinhold Messner interview documentary" },
  @{ key = "Alex Honnold"; q = "Alex Honnold Free Solo El Capitan" },
  @{ key = "Naomi Uemura"; q = "植村直己 ドキュメンタリー" },
  @{ key = "Junko Tabei"; q = "田部井淳子 エベレスト 女性初" },
  @{ key = "Ueli Steck"; q = "Ueli Steck Eiger speed record" },
  @{ key = "Nirmal Purja"; q = "Nirmal Purja 14 peaks documentary" },
  @{ key = "Jerzy Kukuczka"; q = "Jerzy Kukuczka himalaya documentary" },
  @{ key = "Edmund Hillary"; q = "Edmund Hillary Tenzing Norgay Everest 1953" },
  @{ key = "Walter Bonatti"; q = "Walter Bonatti alpinist documentary" },
  @{ key = "Lynn Hill"; q = "Lynn Hill The Nose free climb" },
  @{ key = "Marc-Andre Leclerc"; q = "The Alpinist Marc-Andre Leclerc" },
  @{ key = "Yasushi Yamanoi"; q = "山野井泰史 クライマー" },
  @{ key = "Jimmy Chin"; q = "Jimmy Chin Meru climbing" },
  @{ key = "Tommy Caldwell"; q = "Tommy Caldwell Dawn Wall" },
  @{ key = "Kilian Jornet"; q = "Kilian Jornet Everest speed" },
  @{ key = "Adam Ondra"; q = "Adam Ondra Silence 9c" },
  @{ key = "Kazuya Hiraide"; q = "平出和也 登山" },
  @{ key = "Yuichiro Miura"; q = "三浦雄一郎 エベレスト 80歳" },
  @{ key = "Kami Rita"; q = "Kami Rita Sherpa Everest record" },
  @{ key = "Gerlinde Kaltenbrunner"; q = "Gerlinde Kaltenbrunner K2" }
)
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
$result = @{}
foreach ($item in $queries) {
  Start-Sleep -Seconds 2
  try {
    $q = [uri]::EscapeDataString($item.q)
    $html = (Invoke-WebRequest -Uri "https://www.youtube.com/results?search_query=$q" -UseBasicParsing -TimeoutSec 30 -Headers @{ "User-Agent" = $ua; "Accept-Language" = "ja,en;q=0.8" }).Content
    $ids = [regex]::Matches($html, '"videoId":"([A-Za-z0-9_-]{11})"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique -First 4
    foreach ($id in $ids) {
      Start-Sleep -Milliseconds 500
      try {
        $oe = Invoke-RestMethod -Uri "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D$id&format=json" -TimeoutSec 15 -Headers @{ "User-Agent" = $ua }
        if ($oe.title) { $result[$item.key] = @{ id = $id; title = $oe.title; author = $oe.author_name }; break }
      } catch {}
    }
  } catch {}
  Write-Output "$($item.key): $(if ($result[$item.key]) { $result[$item.key].id } else { 'FAIL' })"
}
$out = Join-Path $PSScriptRoot "climber-videos.json"
$result | ConvertTo-Json -Depth 4 | Out-File $out -Encoding utf8
Write-Output "saved $($result.Count) videos"

