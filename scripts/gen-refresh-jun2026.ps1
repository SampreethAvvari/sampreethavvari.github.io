# Generates the Enterprise Search cover in the site house style via Vertex
# nano-banana. (The hero aurora art is gone; the hero renders live WebGL on
# every device now.)
param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  [string[]]$Only = @("enterprise-search")
)
[Net.ServicePointManager]::Expect100Continue = $false
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path $PSScriptRoot -Parent

$entPrompt = @"
Dark cinematic 3D render on a near-black background, premium tech-editorial style. A central translucent glass panel glowing with thin neon emerald and cyan edges, representing a single clean search answer. Flowing into it from the left, two parallel streams of small glowing particles converge, one cobalt-blue stream of sharp angular shards suggesting keyword search and one emerald stream of soft rounded nodes suggesting semantic vectors, merging into one brighter beam just before the panel. Thin glowing connector lines link the panel to a few small translucent source cards floating behind it, suggesting citations. Soft emerald and cyan volumetric fog low in the frame, gentle haze, floating dust particles. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 composition.
"@

$jobs = @(
  @{ Key = "enterprise-search"; Out = (Join-Path $root "public\enterprise-search.png"); Prompt = $entPrompt }
)

$token = (gcloud auth print-access-token) 2>$null
if (-not $token) { Write-Error "no token"; exit 2 }
$url = "https://aiplatform.googleapis.com/v1/projects/$Project/locations/global/publishers/google/models/${Model}:generateContent"

foreach ($j in $jobs) {
  if ($Only -notcontains $j.Key) { continue }
  $body = @{
    contents = @(@{ role = "user"; parts = @(@{ text = $j.Prompt }) })
    generationConfig = @{ responseModalities = @("IMAGE"); imageConfig = @{ aspectRatio = "16:9" } }
  } | ConvertTo-Json -Depth 10
  try {
    $resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
  } catch { Write-Error "Request failed for $($j.Key): $_"; continue }
  $b64 = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1 -ExpandProperty inlineData | Select-Object -ExpandProperty data
  if (-not $b64) { Write-Error "No image for $($j.Key)"; continue }
  [IO.File]::WriteAllBytes($j.Out, [Convert]::FromBase64String($b64))
  Write-Output ("Saved {0} ({1} KB)" -f $j.Out, [math]::Round(([IO.FileInfo]$j.Out).Length/1KB))
}
