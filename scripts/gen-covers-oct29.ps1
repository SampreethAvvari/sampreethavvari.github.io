param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  [string]$Only = ""
)

# Covers for the posts written on Oct 29, 2026. Same house style as the
# October covers (an object that stands for the problem, in glass), so a
# cover never looks like the architecture card under it, which is a layout
# drawing. Prompts stay ASCII only. Originals land in image-originals/,
# the site serves public/<slug>.avif and .webp.

[Net.ServicePointManager]::Expect100Continue = $false
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$style = "Dark cinematic 3D render on a near-black background, premium tech-editorial style. Translucent glass objects with thin glowing neon edges, soft volumetric fog hugging the floor, faint floating dust particles, gentle light haze, lots of negative space, dark moody lighting. No text, no letters, no numbers, no people, no faces, no logos. 16:9 composition, full bleed, no black bars."

$covers = [ordered]@{
  "doctor-portal" = "A small glass intraoral scanner wand rests on the left. In the centre a single translucent glass case folder lies open, and a thin blank glass sheet with no marks or symbols glides into it from the right along a soft beam of light. The scene fills the whole frame edge to edge. Behind it, out of focus, a second faded folder dissolves into dust. Warm amber edges with a soft white glow."
  "launchpad" = "A wide translucent glass control desk seen from a low angle, with a neat grid of small glowing app tiles hovering above it in even rows, like a launch board before a mission. A thin glowing ribbon runs along the front edge of the desk. Warm amber edges with faint crimson reflections."
  "data-connector" = "A glass plug and a glass socket floating a hand width apart in the dark, a thin bright arc of light jumping the gap between them. Behind the socket, faintly, a tall glass cabinet of thin shelves holding rows of tiny glowing cards. Emerald green edges with a soft white glow."
  "hybridge-websites" = "Two tall translucent glass browser windows standing side by side at a slight angle, one showing a softly glowing glass dental arch model, the other a single precise titanium implant part on a beam of light. A thin phone sized glass pane leans beside them. Crimson red edges with a soft amber glow."
  "platform" = "A night view of a small glass city on a dark plain: about a dozen translucent glass buildings of different heights joined by thin glowing roads of light, three taller towers in the middle, and faint traffic of tiny light pulses moving between them. Warm amber edges with thin emerald and crimson reflections."
  "cdf-registry" = "A single heavy glass vault door standing ajar in the dark, a thin beam of light coming out of it and splitting toward two small glass terminals waiting nearby. Crimson red edges with a soft amber glow."
  "feature-requests" = "Six small glass paper planes gliding in from different directions toward one translucent glass mailbox in the centre, one plane just landing inside it with a small burst of light. The scene fills the entire frame from top edge to bottom edge, wide cinematic framing with fog across the whole floor. Crimson red edges with a soft amber glow."
  "pdf-renderer" = "A translucent glass printing press in the dark pressing a thin blank sheet of light, with two finished blank glass pages lying side by side on the floor beside it. Crimson red edges with a soft white glow."
  "denticon-sync" = "A tall glass tower on the left and its exact reflection forming in a still dark pool of water on the right, a thin ripple of light travelling across the water between them. Crimson red edges with a soft amber glow."
  "forward-deployed-engineer" = "A single translucent glass workbench in a dim room, a glass laptop open on it giving off soft light, a glass clipboard and a glass coffee cup beside it, and through a tall glass window three small glowing office buildings in the distance. The scene fills the entire frame. Warm amber edges with emerald reflections."
  "what-it-costs" = "A row of small translucent glass coin stacks of different heights glowing on a dark floor, each topped by a tiny glass server block, the tallest stack in the middle, one thin line of light joining their tops like a chart. The scene fills the entire frame. Warm amber edges with a soft white glow."
}

New-Item -ItemType Directory -Force -Path "image-originals" | Out-Null
$token = gcloud auth print-access-token
$url = "https://aiplatform.googleapis.com/v1/projects/$Project/locations/global/publishers/google/models/${Model}:generateContent"

foreach ($name in $covers.Keys) {
  if ($Only -and ($Only.Split(",") -notcontains $name)) { continue }
  $prompt = "$style $($covers[$name])"
  $body = @{
    contents = @(@{ role = "user"; parts = @(@{ text = $prompt }) })
    generationConfig = @{ responseModalities = @("IMAGE"); imageConfig = @{ aspectRatio = "16:9" } }
  } | ConvertTo-Json -Depth 10
  try {
    $resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
    $b64 = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1 -ExpandProperty inlineData | Select-Object -ExpandProperty data
    if (-not $b64) { Write-Output "$name : no image in response"; continue }
    $out = Join-Path (Get-Location) "image-originals/$name.png"
    [IO.File]::WriteAllBytes($out, [Convert]::FromBase64String($b64))
    node -e "const s=require('sharp');Promise.all([s('image-originals/$name.png').resize(1600).avif({quality:52}).toFile('public/$name.avif'),s('image-originals/$name.png').resize(1600).webp({quality:78}).toFile('public/$name.webp')]).then(()=>console.log('$name : converted'))"
  } catch {
    Write-Output "$name : $($_.Exception.Message)"
  }
}


