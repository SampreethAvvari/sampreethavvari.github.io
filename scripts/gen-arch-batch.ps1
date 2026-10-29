param(
  # Comma separated slugs; empty means every slug in arch-scenes.json.
  [string]$Only = ""
)

# Re-roll architecture card art in bulk from scripts/arch-scenes.json, one
# colour per kind of work (AIE emerald, FDE amber, MLE violet, SDE crimson,
# a thin second colour for systems that span two), then convert each to the
# AVIF and WebP the site serves.

$scenes = Get-Content -Raw "scripts/arch-scenes.json" | ConvertFrom-Json
$slugs = $scenes.PSObject.Properties.Name
if ($Only) { $slugs = $Only.Split(",") }

foreach ($slug in $slugs) {
  $scene = $scenes.$slug
  if (-not $scene) { Write-Output "$slug : no scene"; continue }
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gen-arch-images.ps1 -Slug $slug -Scene $scene
  if (Test-Path "image-originals/arch/$slug.png") { node scripts/arch-image-convert.mjs $slug }
}
