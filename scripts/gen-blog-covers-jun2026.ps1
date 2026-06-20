# Generates the two new blog covers (Reconciliation, CDF) in the site house style
# via Vertex nano-banana. ASCII-only prompts; PS 5.1 proxy fix included.
param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  [string[]]$Only = @("reconciliation", "cdf")
)

[Net.ServicePointManager]::Expect100Continue = $false
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path $PSScriptRoot -Parent

$reconPrompt = @"
Dark cinematic 3D render on a near-black background, premium tech-editorial style. Three translucent glass document panels (rounded-rectangle sheets) floating and converging toward a single point at the center of the frame, each glowing with thin neon edges in a different cool accent (one cobalt blue, one teal, one soft cyan), suggesting three separate records being cross-checked into one. At the convergence point a single brighter glass card emerges, marked with a few small glowing emerald check symbols and one small amber warning symbol, suggesting the handful of flagged exceptions among many cleared. Faint thin glowing connector lines link the three panels to the central card. Soft blue and teal volumetric fog hugging the floor, gentle light haze, small floating dust particles. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 composition.
"@

$cdfPrompt = @"
Dark cinematic 3D render on a near-black background, premium tech-editorial style. A central translucent glass panel shaped like a premium diagnostic report, glowing with thin neon amber and gold edges, floating in the center of the frame. Orbiting it and feeding into it, several smaller translucent glass elements suggesting different imaging inputs: a faint volumetric scan block, a curved panoramic strip, a small grid of photo tiles, and a thin abstract topographic contour map of a dental arch drawn in glowing gold lines like a topo map rather than anatomy. Thin glowing connector lines route from each input into the central report panel. A subtle split highlight on one element suggests a current versus ideal comparison. Soft amber and warm gold volumetric fog low in the frame, gentle haze, floating dust particles. No text, no letters, no numbers, no people, no logos, no recognizable teeth. Minimalist, lots of negative space, dark moody lighting, 16:9 composition.
"@

$jobs = @(
  @{ Key = "reconciliation"; Out = (Join-Path $root "public\reconciliation.png"); Prompt = $reconPrompt },
  @{ Key = "cdf";            Out = (Join-Path $root "public\cdf-diagnostic-filter.png"); Prompt = $cdfPrompt }
)

$token = (gcloud auth print-access-token) 2>$null
if (-not $token) { Write-Error "gcloud access token unavailable. Run: gcloud auth login (account savvari@hybridgeimplants.com), then re-run this script."; exit 2 }

$url = "https://aiplatform.googleapis.com/v1/projects/$Project/locations/global/publishers/google/models/${Model}:generateContent"

foreach ($j in $jobs) {
  if ($Only -notcontains $j.Key) { continue }
  $body = @{
    contents = @(@{ role = "user"; parts = @(@{ text = $j.Prompt }) })
    generationConfig = @{ responseModalities = @("IMAGE"); imageConfig = @{ aspectRatio = "16:9" } }
  } | ConvertTo-Json -Depth 10
  try {
    $resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
  } catch {
    Write-Error "Request failed for $($j.Key): $_"
    continue
  }
  $b64 = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1 -ExpandProperty inlineData | Select-Object -ExpandProperty data
  if (-not $b64) { Write-Error "No image in response for $($j.Key)"; continue }
  [IO.File]::WriteAllBytes($j.Out, [Convert]::FromBase64String($b64))
  Write-Output ("Saved {0} ({1} KB)" -f $j.Out, [math]::Round(([IO.FileInfo]$j.Out).Length/1KB))
}
