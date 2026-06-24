# Downloads brand-coloured official SVG logos (Simple Icons) for the skills
# wall into public/logos/skills/. Self-hosted so the site has no runtime CDN
# dependency. Slugs that 404 are reported and skipped (rendered as text chips).
[Net.ServicePointManager]::Expect100Continue = $false
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $root "public\logos\skills"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$slugs = @(
  # AIE
  "openai","anthropic","huggingface","langchain","googlegemini","pydantic","milvus",
  # MLE
  "pytorch","scikitlearn","numpy","pandas","onnx","mlflow","wandb","keras","opencv",
  # FDE
  "googlecloud","googlebigquery","looker","googlesheets","slack","figma","zoom","gmail",
  # SDE
  "python","typescript","go","react","nextdotjs","fastapi","postgresql","docker","kubernetes","terraform","githubactions","pytest","redis","nodedotjs"
)

$ok = @(); $fail = @()
foreach ($s in $slugs) {
  $out = Join-Path $dir "$s.svg"
  $url = "https://cdn.simpleicons.org/$s"
  try {
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -ErrorAction Stop
    if ((Get-Item $out).Length -gt 80) { $ok += $s } else { Remove-Item $out -Force; $fail += $s }
  } catch { $fail += $s }
}
Write-Output ("OK ({0}): {1}" -f $ok.Count, ($ok -join ", "))
Write-Output ("FAIL ({0}): {1}" -f $fail.Count, ($fail -join ", "))
