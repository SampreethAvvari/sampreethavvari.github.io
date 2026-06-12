param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  [string[]]$Only = @()  # e.g. -Only aie,mle to re-roll specific images
)

$style = "Dark cinematic 3D render on a near-black background, premium tech-editorial style. Soft volumetric fog hugging the floor, gentle light haze, small floating dust particles. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 composition."

$images = @(
  @{
    slug = "aie"
    prompt = "A floating translucent glass document panel glowing with thin neon emerald-green edges, centered slightly left. Flowing into it from the left: a loose, organic stream of soft glowing emerald particles (unstructured input). Flowing out the right side: the same particles snapped into a perfect orderly lattice of small glass cells (structured output). One cell in the lattice glows brighter with a tiny emerald check mark. Subtle emerald and teal tones. $style"
  },
  @{
    slug = "fde"
    prompt = "A glowing amber-gold translucent glass bridge arcing between two floating dark glass platforms, seen from a low dramatic angle. The left platform holds a small cluster of chaotic, scattered translucent shards; the right platform holds the same shards reassembled into a neat, calm geometric structure. Thin warm amber light traces along the bridge's edge. Subtle gold and bronze tones. $style"
  },
  @{
    slug = "mle"
    prompt = "A floating stack of thin translucent glass slices forming a volumetric 3D scan cube, glowing with soft neon violet edges, centered. One slice is pulled slightly out of the stack and glows brighter, revealing a faint abstract heat-map bloom inside it. Beside the stack, three tiny floating glass panels suggest rising abstract training curves as simple glowing arcs. Subtle violet and indigo tones. $style"
  },
  @{
    slug = "sde"
    prompt = "A precise architectural structure of interlocking translucent glass blocks and two short glass cylinders (databases), assembled like a minimal floating city block, glowing with thin neon blue edges. Every block aligned to a faint blue grid plane below. One block is mid-placement, hovering slightly above its slot, with a soft blue glow underneath. Subtle blue and steel tones. $style"
  }
)

# PS 5.1: force TLS 1.2 and drop the Expect: 100-continue header, which some
# proxies answer with 417 / interstitial pages instead of forwarding.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::Expect100Continue = $false

$token = gcloud auth print-access-token
$url = "https://aiplatform.googleapis.com/v1/projects/$Project/locations/global/publishers/google/models/${Model}:generateContent"

foreach ($img in $images) {
  if ($Only.Count -gt 0 -and $Only -notcontains $img.slug) { continue }
  $outFile = "public/discipline-$($img.slug).png"

  $body = @{
    contents = @(@{
      role = "user"
      parts = @(@{ text = $img.prompt })
    })
    generationConfig = @{
      responseModalities = @("IMAGE")
      imageConfig = @{ aspectRatio = "16:9" }
    }
  } | ConvertTo-Json -Depth 10

  Write-Output "Generating $outFile ..."
  $resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body

  $b64 = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1 -ExpandProperty inlineData | Select-Object -ExpandProperty data
  if (-not $b64) { Write-Error "No image in response for $($img.slug)"; continue }
  [IO.File]::WriteAllBytes((Join-Path (Get-Location) $outFile), [Convert]::FromBase64String($b64))
  Write-Output "Saved $outFile ($([math]::Round(([IO.FileInfo](Join-Path (Get-Location) $outFile)).Length/1KB)) KB)"
}
