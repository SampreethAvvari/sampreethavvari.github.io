param(
  [string]$Project = "hybridge-npc-prod",
  [string]$Model = "gemini-2.5-flash-image",
  [string[]]$Only = @()  # e.g. -Only cbct-validator,jobpilot to re-roll specific images
)

# One-off batch: re-roll project/post hero images so each one carries its
# discipline's accent colour (AIE emerald #34D399, FDE amber #F5A524,
# MLE violet #A78BFA, SDE blue #5B8DEF). Concepts stay the same as the
# images they replace; only the palette moves.

$style = "Dark cinematic 3D render on a near-black background, premium tech-editorial style. Soft volumetric fog hugging the floor, gentle light haze, small floating dust particles. No text, no letters, no numbers, no people, no logos. Minimalist, lots of negative space, dark moody lighting, 16:9 composition."

$images = @(
  # ---- MLE (violet) ----
  @{
    slug = "cbct-validator"
    prompt = "A human skull and jaw rendered as a hologram of thousands of tiny glowing violet particles, seen in profile, centered slightly left. A thin horizontal bright violet scan line passes through the teeth, slightly brighter where it crosses the jaw. To the right, a small floating glass toggle pill glows with a soft violet dot. Subtle violet and indigo tones only. $style"
  },
  @{
    slug = "loan-radar"
    prompt = "A large minimal radar dial made of thin concentric glass rings, glowing soft neon violet, with one bright violet sweep beam and a tiny blip dot near the lower-left ring. To its right, a neat vertical column of six small glowing violet indicator orbs like promotion gates. Subtle violet and indigo tones only. $style"
  },
  @{
    slug = "resnet-compact"
    prompt = "A compact stack of small rounded translucent glass slabs pressed tightly together like a miniature model, framed inside a thin floating glass panel with soft neon violet edges. Beside it, a small glass speedometer-style gauge with a thin violet needle. The whole composition reads as small but powerful. Subtle violet and indigo tones only. $style"
  },
  @{
    slug = "customer-segmentation"
    prompt = "A vast loose cloud of thousands of tiny glowing violet particles on the left funnels through a narrow neck of converging light threads into a small, perfectly ordered short stack of five glowing glass bars on the right, like a ranked shortlist. Subtle violet and indigo tones only. $style"
  },

  # ---- FDE (amber) ----
  @{
    slug = "cowork-dashboard"
    prompt = "Two floating translucent glass database tables with faint row lines, facing each other left and right, on a near-black floor. A single thin brilliant amber-gold beam of light connects them, with tiny golden particles drifting along the beam from left to right and a small bright amber join-point dot where the beam meets the right table. Subtle amber, gold and bronze tones only. $style"
  },
  @{
    slug = "film-and-engineering"
    prompt = "A translucent glass film clapperboard floating on the left and a translucent glass laptop floating on the right, both glowing with thin neon amber-gold edges, facing each other like equals across a thin vertical seam of soft golden light. Matching warm amber fog under both. Subtle amber, gold and bronze tones only. $style"
  },

  # ---- AIE (emerald) ----
  @{
    slug = "npc-coach"
    prompt = "A large circular arrow made of thin glowing emerald light, sweeping clockwise like a coaching feedback loop, centered slightly left. Inside its lower-right opening, three small ascending translucent glass bars glow progressively brighter emerald, suggesting improvement. A tiny bright emerald dot rides the arrow's tip. Subtle emerald and teal tones only. $style"
  },
  @{
    slug = "jobpilot-judge"
    prompt = "A single floating translucent glass resume sheet with faint abstract text-line bars, centered, being scanned by a thin horizontal emerald light bar. Rows above the scan line carry small glowing emerald check marks; rows below it still carry faint dim red tick marks, mid-transformation. A small glass rubric panel floats at the right edge with three tiny emerald score pips. Subtle emerald and teal tones, single faint red accents only on the unscanned marks. $style"
  },

  # ---- SDE (blue) ----
  @{
    slug = "treatment-estimator"
    prompt = "A large translucent glass price tag with a rounded hole and a small glowing padlock embossed on its face, floating centered, edges traced in thin neon steel-blue light. Behind it, very faint and out of focus, a minimal branching decision-tree of thin blue lines and nodes. Subtle blue and steel tones only. $style"
  },
  @{
    slug = "pipeline-ghosting"
    prompt = "A dark floating glass dashboard panel with faint chart shapes, edges traced in thin neon steel-blue light. On top of it, one rounded status pill glows calm green but is cracked open down the middle, and through the crack a hot amber warning glow leaks out with tiny floating shards, revealing what the green was hiding. Everything else in subtle blue and steel tones. $style"
  },
  @{
    slug = "jobpilot"
    prompt = "A stream of small translucent glass cards flows in from the left and converges into a single glowing glass document, which folds at its front edge into a paper plane lifting off along a thin rising steel-blue arc of light toward the upper right. Edges traced in thin neon steel-blue light. Subtle blue and steel tones only. $style"
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
  $outFile = "public/$($img.slug).png"

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
  # $resp must be reset each pass: a failed Invoke-RestMethod leaves the
  # previous response in scope and the stale image gets saved under the
  # wrong name. Retry 429s with a backoff instead of skipping.
  $resp = $null
  for ($attempt = 1; $attempt -le 6 -and -not $resp; $attempt++) {
    try {
      $resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
    } catch {
      $status = $null
      if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
      if ($status -eq 429 -and $attempt -lt 6) {
        Write-Output "  429 rate-limited, retrying in 30s (attempt $attempt/6) ..."
        Start-Sleep -Seconds 30
      } else {
        Write-Error "Request failed for $($img.slug): $($_.Exception.Message)"
        break
      }
    }
  }
  if (-not $resp) { continue }

  $b64 = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1 -ExpandProperty inlineData | Select-Object -ExpandProperty data
  if (-not $b64) { Write-Error "No image in response for $($img.slug)"; continue }
  [IO.File]::WriteAllBytes((Join-Path (Get-Location) $outFile), [Convert]::FromBase64String($b64))
  Write-Output "Saved $outFile ($([math]::Round(([IO.FileInfo](Join-Path (Get-Location) $outFile)).Length/1KB)) KB)"
  Start-Sleep -Seconds 12  # stay under the per-minute quota
}
