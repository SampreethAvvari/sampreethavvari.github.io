param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  [string]$OutFile = "public/jobpilot-flagship.png"
)

# PS 5.1 + Invoke-RestMethod to Google APIs: disable the 100-continue handshake
# or large POSTs intermittently stall. (House note from the image-gen scripts.)
[System.Net.ServicePointManager]::Expect100Continue = $false

# JobPilot flagship hero — the project spans all four disciplines, so all four
# accent colours appear: AIE emerald (#34D399), FDE amber (#F5A524),
# MLE violet (#A78BFA), SDE blue (#5B8DEF). Autopilot-cockpit concept.
# Kept deliberately ASCII-only: PS 5.1 mangles em-dashes / smart quotes in the
# here-string and the API 400s on the resulting bytes. Plain punctuation only.
$prompt = @"
Dark cinematic 3D render on a near-black background, premium tech-editorial style. A sleek translucent glass cockpit console, an autopilot control panel, seen at a slight three-quarter angle, centered with generous negative space. Four thin glowing data streams flow in from the left edge in four distinct neon colors: emerald green, warm amber, soft violet purple, and cool blue. They curve and converge through the console, then merge into a single crisp glowing document, a one-page resume sheet, that lifts and takes flight toward the upper right with a faint paper-plane motion trail behind it. The four colored streams stay visually distinct as they merge. Faint holographic dials, a compass-needle motif, and abstract horizontal score bars float on the console glass, all unlit with no text. Soft multicolor volumetric fog hugs the floor where the four hues blend, gentle light haze, small floating dust particles, subtle lens bloom. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 cinematic composition.
"@

$body = @{
  contents = @(@{
    role = "user"
    parts = @(@{ text = $prompt })
  })
  generationConfig = @{
    responseModalities = @("IMAGE")
    imageConfig = @{ aspectRatio = "16:9" }
  }
} | ConvertTo-Json -Depth 10

$token = gcloud auth print-access-token
$url = "https://aiplatform.googleapis.com/v1/projects/$Project/locations/global/publishers/google/models/${Model}:generateContent"

$resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body

$b64 = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1 -ExpandProperty inlineData | Select-Object -ExpandProperty data
if (-not $b64) { Write-Error "No image in response"; $resp | ConvertTo-Json -Depth 10; exit 1 }
[IO.File]::WriteAllBytes((Join-Path (Get-Location) $OutFile), [Convert]::FromBase64String($b64))
Write-Output "Saved $OutFile ($([math]::Round(([IO.FileInfo](Join-Path (Get-Location) $OutFile)).Length/1KB)) KB)"
