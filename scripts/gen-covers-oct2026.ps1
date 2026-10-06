param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  [string]$Only = ""
)

# Covers for the October 2026 posts. House style: dark cinematic 3D, near
# black background, translucent glass with thin neon edges, volumetric fog,
# no text, people or logos, 16:9. Prompts stay ASCII only (PS 5.1 mangles
# smart punctuation and the API then returns no image).

[Net.ServicePointManager]::Expect100Continue = $false
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$style = "Dark cinematic 3D render on a near-black background, premium tech-editorial style. Translucent glass objects with thin glowing neon edges, soft volumetric fog hugging the floor, faint floating dust particles, gentle light haze, lots of negative space, dark moody lighting. No text, no letters, no numbers, no people, no faces, no logos. 16:9 composition."

$covers = [ordered]@{
  "patient-dashboard" = "A single tall translucent glass panel in the center holding one bright horizontal row, like one patient record, with thin glowing emerald and teal edges. Several smaller glass cards (a document, a calendar tile, a small x-ray shaped tile, a chat bubble) float toward the row from the left and right along thin glowing threads and click into place on it. Behind, very faint and out of focus, a large grid of identical rows recedes into the dark."
  "capacity-planner" = "A floating translucent glass grid of small square cells seen at a slight angle, split into three blocks, with thin glowing blue edges. Small glass dental chair silhouettes sit in some cells as simple shapes; a few cells glow softly amber where a day is too full. A thin glowing blue horizontal line runs across the grid like a level, keeping it balanced. Soft blue fog below. The grid has no labels, no headings and no writing of any kind, only shapes and light."
  "treatment-sequence" = "A horizontal path of six translucent glass stepping stones floating in the dark, each a rounded tile with a thin glowing amber edge, connected by thin glowing lines with small gaps between them like waits between visits. The first tiles are lit brighter, the later ones dimmer, fading into the fog. A faint glass document page hovers above the path, its lines echoing the stones."
  "daily-sales-report" = "A translucent glass forecast chart floating in the dark: a single glowing violet line rising gently from left to right, wrapped in a soft translucent band that widens toward the future like an uncertainty range. Below it, a thin stack of glass sheets suggesting daily reports slides into a small glass box. A faint lock shaped glass frame surrounds the line, keeping it fixed."
  "case-intake" = "Two translucent glass case folders floating side by side in the dark with thin glowing crimson-free warm white edges, one slightly behind the other, nearly identical, joined by a thin glowing blue thread where they match. A small glass dental arch model sits on the front folder. Soft blue fog below. No labels, no writing."
  "hybridge-forms" = "A single translucent glass form card floating in the dark with three empty rounded input fields and a rounded button shape, thin glowing teal edges. A thin bright line leaves the card and splits into two paths into two small plain unlabeled glass cubes below it, both softly lit. Soft teal fog below. Absolutely no text, labels, letters or words anywhere in the image."
  "marketing-warehouse" = "Six thin glowing cyan streams of light flow in from the edges of the frame, each starting at a small distinct glass icon shape (a phone, a click cursor, a megaphone, a card, a chat bubble, a funnel), and pour into a layered translucent glass vessel with three stacked shelves in the center. From the top shelf one clean bright line rises upward. Soft cyan fog at the base. Full bleed image that fills the whole frame edge to edge, no black bars, no letterbox, no border."
}

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
    $out = Join-Path (Get-Location) "public/$name.png"
    [IO.File]::WriteAllBytes($out, [Convert]::FromBase64String($b64))
    Write-Output "$name : saved ($([math]::Round(([IO.FileInfo]$out).Length/1KB)) KB)"
  } catch {
    Write-Output "$name : failed $($_.Exception.Message)"
  }
}
