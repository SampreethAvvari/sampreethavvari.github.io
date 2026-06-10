param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  [string]$OutFile = "public/doctor-report-cards.png"
)

$prompt = @"
Dark cinematic 3D render on a near-black background, premium tech-editorial style. A single floating translucent glass report card (clipboard-like rounded rectangle) glowing with thin neon emerald-green edges, centered in frame. On the card: a few abstract horizontal score rows — three rows marked with glowing emerald check marks, one row with a small amber warning mark. Behind it, very faint and out of focus, two smaller duplicate glass cards suggesting a stack of doctors' reports. A subtle thin glowing line traces from the card toward a tiny glowing envelope icon at the right edge. Soft emerald and teal volumetric fog hugging the floor, gentle light haze, small floating dust particles. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 composition.
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
