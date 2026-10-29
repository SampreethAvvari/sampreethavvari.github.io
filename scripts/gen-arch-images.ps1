param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  # One image: pass -Slug and -Scene. The scene is only the system specific
  # part; the shared style below is added to every prompt.
  [string]$Slug = "",
  [string]$Scene = ""
)

# Art for the architecture card at the top of each post. One look across all
# of them: a glass blueprint of the system, modules joined by light, seen from
# above at an angle, so the card reads as "this is how it is built" before any
# words. Prompts stay ASCII only (PS 5.1 mangles smart punctuation and the API
# then returns no image). Originals land in image-originals/arch/<slug>.png;
# convert with: node scripts/arch-image-convert.mjs <slug>

[Net.ServicePointManager]::Expect100Continue = $false
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$style = "Dark cinematic 3D render on a near-black background with a very faint star field. An exploded isometric blueprint of a software system, seen from above at a 35 degree angle: flat translucent glass tiles of different sizes laid out on an invisible grid, each tile with a thin glowing edge, joined by thin bright lines of light that run at right angles like circuit traces, with tiny bright pulses travelling along them. Fine hairline grid lines and small crosshair registration marks on the dark floor, like an engineering drawing. Soft volumetric haze, shallow depth of field. No text, no letters, no numbers, no labels, no people, no logos. 16:9, full bleed."

$scenes = [ordered]@{
  "capacity-planner" = "Eleven glass tiles in three rows. In the middle row a stream of light flows from a tile on the far left through two tiles to a larger central tile that glows brightest in cool blue, then on to a tile on the right. A small tile above the central one pulses once like a clock tick. Below the central tile sits a thicker tile like a stacked disk. Palette: cool blue with one soft white highlight."
}
if ($Slug -and $Scene) { $scenes = [ordered]@{ $Slug = $Scene } }

New-Item -ItemType Directory -Force -Path "image-originals/arch" | Out-Null
$token = gcloud auth print-access-token
$url = "https://aiplatform.googleapis.com/v1/projects/$Project/locations/global/publishers/google/models/${Model}:generateContent"

foreach ($name in $scenes.Keys) {
  if ($Slug -and $name -ne $Slug) { continue }
  $prompt = "$style $($scenes[$name])"
  $body = @{
    contents = @(@{ role = "user"; parts = @(@{ text = $prompt }) })
    generationConfig = @{ responseModalities = @("IMAGE"); imageConfig = @{ aspectRatio = "16:9" } }
  } | ConvertTo-Json -Depth 10
  try {
    $resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
    $b64 = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1 -ExpandProperty inlineData | Select-Object -ExpandProperty data
    if (-not $b64) { Write-Output "$name : no image in response"; continue }
    $out = Join-Path (Get-Location) "image-originals/arch/$name.png"
    [IO.File]::WriteAllBytes($out, [Convert]::FromBase64String($b64))
    Write-Output "$name : saved ($([math]::Round(([IO.FileInfo]$out).Length/1KB)) KB)"
  } catch {
    Write-Output "$name : $($_.Exception.Message)"
  }
}
