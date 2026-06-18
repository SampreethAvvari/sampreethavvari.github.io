param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image"
)

# Four hero images for the NPC Coach blog series. House style: near-black
# background, one glowing neon 3D object, soft floor reflection, a single accent
# colour matching each post's `tone` frontmatter, 16:9, no text.
#
# Run after `gcloud auth login` (the access token must refresh non-interactively):
#   powershell -File scripts/gen-npc-images.ps1
# Then regenerate the .webp siblings:
#   node scripts/compress-images.mjs
#
# ASCII-only prompts on purpose: PS 5.1 mangles em-dashes / smart quotes in the
# here-string and the API 400s on the resulting bytes. Plain punctuation only.

# Large POSTs to Google APIs intermittently stall on the 100-continue handshake.
[System.Net.ServicePointManager]::Expect100Continue = $false

$images = @(
  @{
    Out = "public/npc-coach-scoring.png"
    Prompt = "Dark cinematic 3D render on a near-black background, premium tech-editorial style. A single sleek translucent glass scoring gauge, a smooth semicircular dial, glowing with thin neon violet-purple edges, centered with generous negative space. Beneath it, three horizontal glowing bars of clearly different lengths suggesting a weighted breakdown, the same violet glow. Off to one side, one small glowing rounded badge in warm red floats apart from the gauge, like a flag set beside a number. Soft violet and magenta volumetric fog hugging the floor with a faint mirror reflection, gentle light haze, small floating dust particles, subtle lens bloom. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 cinematic composition."
  },
  @{
    Out = "public/npc-coach-architecture.png"
    Prompt = "Dark cinematic 3D render on a near-black background, premium tech-editorial style. A single glowing translucent hexagonal hub module floating in the center, with several empty socket ports around its edges and a few plug-shaped adapter blocks hovering nearby as if about to connect, all glowing with thin neon blue edges. One prominent glowing toggle switch sits in the foreground, clearly in the off position, suggesting a master switch. Soft blue volumetric fog hugging the floor with a faint mirror reflection, gentle light haze, small floating dust particles, subtle lens bloom. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 cinematic composition."
  },
  @{
    Out = "public/npc-coach-bugs.png"
    Prompt = "Dark cinematic 3D render on a near-black background, premium tech-editorial style. A single floating translucent glass panel showing a grid of small glowing emerald-green check marks, centered in frame. One corner of the panel is cracking and breaking apart into glowing amber and warm-red shards, with a small amber warning triangle glyph emerging from the crack. The contrast between the calm green grid and the breaking amber corner is the focus. Soft amber volumetric fog hugging the floor with a faint mirror reflection, gentle light haze, small floating dust particles, subtle lens bloom. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 cinematic composition."
  },
  @{
    Out = "public/npc-coach-dashboard.png"
    Prompt = "Dark cinematic 3D render on a near-black background, premium tech-editorial style. A single floating translucent glass dashboard panel, slightly angled, glowing with thin neon cyan edges, centered with generous negative space. On the panel, a few abstract list rows with small glowing score bars of different lengths, and along the top a row of five connected glowing dots forming a progress stepper, one of them brighter than the rest. Soft cyan and teal volumetric fog hugging the floor with a faint mirror reflection, gentle light haze, small floating dust particles, subtle lens bloom. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 cinematic composition."
  }
)

$token = gcloud auth print-access-token
$url = "https://aiplatform.googleapis.com/v1/projects/$Project/locations/global/publishers/google/models/${Model}:generateContent"

foreach ($img in $images) {
  $body = @{
    contents = @(@{
      role = "user"
      parts = @(@{ text = $img.Prompt })
    })
    generationConfig = @{
      responseModalities = @("IMAGE")
      imageConfig = @{ aspectRatio = "16:9" }
    }
  } | ConvertTo-Json -Depth 10

  $resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body

  $b64 = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1 -ExpandProperty inlineData | Select-Object -ExpandProperty data
  if (-not $b64) { Write-Error "No image in response for $($img.Out)"; $resp | ConvertTo-Json -Depth 10; continue }
  [IO.File]::WriteAllBytes((Join-Path (Get-Location) $img.Out), [Convert]::FromBase64String($b64))
  Write-Output "Saved $($img.Out) ($([math]::Round(([IO.FileInfo](Join-Path (Get-Location) $img.Out)).Length/1KB)) KB)"
}

Write-Output "Done. Now run: node scripts/compress-images.mjs"
