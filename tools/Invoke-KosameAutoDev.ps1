<#
.SYNOPSIS
  KOSAME Auto-Dev Launcher v110.45
  Invokes auto-dev on WSL and relays progress to Cloud Run Dashboard.

.DESCRIPTION
  Pre-flight checks, then starts activity relay on WSL (background)
  and runs npm run auto:dev with the given specification file.

.PARAMETER SpecFile
  Path to the product specification file (Windows path).

.PARAMETER Project
  Target project name (e.g. anesty-board, kosame-dev-orchestra).

.PARAMETER DryRun
  Run in dry-run mode (default: true). Use -DryRun:$false for live.

.PARAMETER CloudRunUrl
  KOSAME Cloud Run Dashboard URL.

.PARAMETER KosameApiKey
  KOSAME API key. Falls back to $env:KOSAME_API_KEY.

.PARAMETER Help
  Show this help message and exit.

.EXAMPLE
  PS> .\tools\Invoke-KosameAutoDev.ps1 -SpecFile "C:\specs\feature.md" -Project "anesty-board" -DryRun

.EXAMPLE
  PS> $env:KOSAME_API_KEY = "your-key"
  PS> .\tools\Invoke-KosameAutoDev.ps1 -SpecFile "C:\specs\feature.md" -Project "anesty-board"
#>

[CmdletBinding()]
param(
  [string]$SpecFile = "",
  [string]$Project = "",
  [switch]$DryRun,
  [string]$CloudRunUrl = "",
  [string]$KosameApiKey = "",
  [switch]$Help
)

if ($Help) {
  Get-Help $MyInvocation.MyCommand.Path
  exit 0
}

$ErrorActionPreference = "Stop"
$allOk = $true

$GREEN  = "Green"
$RED    = "Red"
$YELLOW = "Yellow"
$CYAN   = "Cyan"
$GRAY   = "DarkGray"

function PreCheck($label, $result, $action) {
  if ($result) {
    Write-Host ("  [PASS] " + $label) -ForegroundColor $GREEN
    return $true
  } else {
    Write-Host ("  [FAIL] " + $label) -ForegroundColor $RED
    if ($action) {
      Write-Host ("         -> " + $action) -ForegroundColor $YELLOW
    }
    return $false
  }
}

function Invoke-WslBash {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  $script = @'
export HOME=/home/lavie
export PATH="$HOME/.local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi
'@ + "`n" + $Command + "`n"

  $bytes    = [System.Text.Encoding]::UTF8.GetBytes($script)
  $b64      = [Convert]::ToBase64String($bytes)
  $output   = & wsl.exe -d Ubuntu -u lavie -- bash -lc "echo '$b64' | base64 -d | bash -s" 2>&1
  $exitCode = $LASTEXITCODE

  return [pscustomobject]@{
    Output   = @($output)
    ExitCode = $exitCode
  }
}

$KOSAME_REPO = "/home/lavie/kosame-dev-orchestra"

# ---- 1. WSL availability ----
$wslOk = $false
try {
  $null = & wsl.exe -d Ubuntu -u lavie --version 2>&1
  $wslOk = ($LASTEXITCODE -eq 0)
} catch {}
if (-not (PreCheck "WSL available" $wslOk "Install WSL: wsl --install")) { $allOk = $false }

# ---- 2. KOSAME directory on WSL ----
$dirOk = $false
if ($wslOk) {
  $r = Invoke-WslBash 'test -d /home/lavie/kosame-dev-orchestra'
  $dirOk = ($r.ExitCode -eq 0)
}
if (-not (PreCheck "/home/lavie/kosame-dev-orchestra exists on WSL" $dirOk "Run: git clone ... /home/lavie/kosame-dev-orchestra")) { $allOk = $false }

# ---- 3. Node.js on WSL ----
$nodeOk = $false; $nodeVer = ""
if ($wslOk) {
  $r = Invoke-WslBash ( 'command -v node >/dev/null 2>&1' + "`n" + 'node --version' )
  $nodeVer = $r.Output -join ""
  $nodeOk = ($r.ExitCode -eq 0 -and $nodeVer -match "^v[0-9]")
  if (-not $nodeOk) { $nodeVer = "" }
}
if (-not (PreCheck "Node.js available on WSL ($nodeVer)" $nodeOk "Install Node.js on WSL")) { $allOk = $false }

# ---- 4. npm on WSL ----
$npmOk = $false; $npmVer = ""
if ($wslOk) {
  $r = Invoke-WslBash ( 'command -v npm >/dev/null 2>&1' + "`n" + 'npm --version' )
  $npmVer = $r.Output -join ""
  $npmOk = ($r.ExitCode -eq 0 -and $npmVer -match "^[0-9]")
  if (-not $npmOk) { $npmVer = "" }
}
if (-not (PreCheck "npm available on WSL ($npmVer)" $npmOk "Install npm on WSL")) { $allOk = $false }

# ---- 5. Claude CLI on WSL ----
$claudeOk = $false; $claudeVer = ""
if ($wslOk) {
  $r = Invoke-WslBash ( 'command -v claude >/dev/null 2>&1' + "`n" + 'claude --version' )
  $claudeVer = $r.Output -join ""
  $claudeOk = ($r.ExitCode -eq 0 -and $claudeVer -ne "")
  if (-not $claudeOk) { $claudeVer = "" }
}
if (-not (PreCheck "Claude CLI available on WSL ($claudeVer)" $claudeOk "Install: npm install -g @anthropic-ai/claude-code")) { $allOk = $false }

# ---- 6. Claude --print test ----
$printOk = $false; $rateLimit = $false
if ($wslOk -and $claudeOk) {
  $r = Invoke-WslBash 'timeout 5 claude --print ok 2>&1 || true'
  if ($r.ExitCode -eq 0) { $printOk = $true }
  elseif (($r.Output -join " ") -match "rate.limit|session.limit|quota|429") { $rateLimit = $true }
}
if ($rateLimit) {
  Write-Host "  [RATE_LIMIT] Claude CLI session limit - wait and retry later" -ForegroundColor $YELLOW
  $allOk = $false
} elseif (-not $printOk) {
  if (-not (PreCheck "Claude --print works" $false "Verify Claude auth: claude --print test")) { $allOk = $false }
} else {
  Write-Host "  [PASS] Claude --print works" -ForegroundColor $GREEN
}

# ---- 7. package.json has auto:dev ----
$scriptOk = $false
if ($wslOk -and $dirOk) {
  $r = Invoke-WslBash @'
cd /home/lavie/kosame-dev-orchestra
node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts['auto:dev']?0:1)"
'@
  $scriptOk = ($r.ExitCode -eq 0)
}
if (-not (PreCheck "package.json has auto:dev script" $scriptOk "Check package.json scripts")) { $allOk = $false }

# ---- 8. SpecFile exists ----
$specOk = $false
if ($SpecFile -and (Test-Path -LiteralPath $SpecFile -PathType Leaf)) { $specOk = $true }
if (-not (PreCheck "SpecFile exists" $specOk "Check path: $SpecFile")) { $allOk = $false }

# ---- 9. Project validation ----
$allowed = @("kosame-dev-orchestra", "anesty-board"); $projOk = ($allowed -contains $Project)
$allowedStr = ($allowed -join ", ")
if (-not (PreCheck "Project is valid ($allowedStr)" $projOk "Project must be one of: $allowedStr")) { $allOk = $false }

# ---- 10. KOSAME_API_KEY ----
if (-not $KosameApiKey) { $KosameApiKey = $env:KOSAME_API_KEY }
$keyOk = (-not [string]::IsNullOrEmpty($KosameApiKey))
if (-not (PreCheck "KOSAME_API_KEY configured (value hidden)" $keyOk "Set -KosameApiKey or `$env:KOSAME_API_KEY")) { $allOk = $false }

# ---- 11. Cloud Run URL ----
if (-not $CloudRunUrl) { $CloudRunUrl = $env:KOSAME_CLOUD_RUN_URL }
$urlOk = (-not [string]::IsNullOrEmpty($CloudRunUrl))
if (-not (PreCheck "KOSAME_CLOUD_RUN_URL configured" $urlOk "Set -CloudRunUrl or `$env:KOSAME_CLOUD_RUN_URL")) { $allOk = $false }

# ---- 12. Google Identity Token ----
$tokenOk = $false; $idToken = ""
if ($wslOk) {
  $r = Invoke-WslBash ( 'command -v gcloud >/dev/null 2>&1' + "`n" + 'gcloud auth print-identity-token' )
  $idToken = $r.Output -join ""
  $tokenOk = ($r.ExitCode -eq 0 -and $idToken -match "^eyJ")
  if (-not $tokenOk) { $idToken = "" }
}
if (-not (PreCheck "Google Identity Token obtained (value hidden)" $tokenOk "Run: gcloud auth login on WSL")) { $allOk = $false }

# ---- 13. Cloud Run /health reachable (with IAM token) ----
$healthOk = $false
if ($urlOk -and $wslOk -and $tokenOk) {
  $r = Invoke-WslBash "curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'Authorization: Bearer $idToken' '$CloudRunUrl/health' 2>/dev/null || echo 000"
  $healthOk = ($r.ExitCode -eq 0 -and ($r.Output -join "") -eq "200")
}
if (-not (PreCheck "Cloud Run /health reachable (IAM auth)" $healthOk "Check Cloud Run status: $CloudRunUrl")) { $allOk = $false }

# ---- Halt on pre-flight failure ----
if (-not $allOk) {
  Write-Host ""
  Write-Host "Pre-flight checks failed. Fix the issue above and retry." -ForegroundColor $RED
  exit 1
}

Write-Host ""
Write-Host "All pre-flight checks passed." -ForegroundColor $GREEN
Write-Host ""

# ---- Convert Windows path to WSL path ----
$absPath = (Resolve-Path $SpecFile).Path
$wslSpecPath = ""

# UNC WSL paths: \\wsl.localhost\Ubuntu\... or \\wsl$\Ubuntu\...
if ($absPath -match '^\\\\wsl') {
  $parts = $absPath.TrimStart('\') -split '\\', 3
  if ($parts.Count -ge 3) { $wslSpecPath = '/' + ($parts[2] -replace '\\', '/') }
}

# Try wslpath via the correct distro
if (-not $wslSpecPath) {
  try {
    $wslRaw = & wsl.exe -d Ubuntu -- wslpath -u $absPath 2>$null
    $wslOut  = (($wslRaw | Where-Object { $_ }) -join '').Trim()
    if ($wslOut -match '^/') { $wslSpecPath = $wslOut }
  } catch {}
}

# Fallback: C:\Users\... → /mnt/c/users/...
if (-not $wslSpecPath) {
  $wslSpecPath = "/mnt/$($absPath -replace '^([A-Za-z]):\\', '${1}/' -replace '\\', '/')".ToLower()
}

Write-Host "  WSL spec path: $wslSpecPath" -ForegroundColor $GRAY

# ---- Build relay environment (no secrets displayed) ----
$relayEnv = "KOSAME_CLOUD_RUN_URL=$CloudRunUrl KOSAME_API_KEY=$KosameApiKey KOSAME_IDENTITY_TOKEN=$idToken"

# ---- Start activity relay on WSL (background) ----
Write-Host "  Starting activity relay on WSL..." -ForegroundColor $CYAN
$relayCmd = "cd $KOSAME_REPO && $relayEnv nohup node tools/kosame-activity-relay.js > /dev/null 2>&1 & echo `$!"
$relayResult = & wsl.exe -d Ubuntu -u lavie -- bash -lc $relayCmd
$relayPid = $relayResult.Trim()
Write-Host "  Relay PID: $relayPid" -ForegroundColor $GRAY

# ---- Build auto-dev arguments ----
$autoDevArgs = "--file=$wslSpecPath --project=$Project --json"
if (-not $DryRun) { $autoDevArgs = "--file=$wslSpecPath --project=$Project --write --json" }

# ---- Run auto-dev on WSL ----
Write-Host ""
Write-Host "============================================" -ForegroundColor $GREEN
Write-Host "  KOSAME Auto-Dev" -ForegroundColor $GREEN
Write-Host "  Project : $Project" -ForegroundColor $GREEN
Write-Host "  DryRun  : $DryRun" -ForegroundColor $GREEN
Write-Host "  Spec    : $SpecFile" -ForegroundColor $GREEN
Write-Host "============================================" -ForegroundColor $GREEN
Write-Host ""

$timeoutLine = if ($env:CLAUDE_TIMEOUT_MS) { "export CLAUDE_TIMEOUT_MS=$($env:CLAUDE_TIMEOUT_MS)" } else { "" }
$autoDevScript = @'
export HOME=/home/lavie
export PATH="$HOME/.local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi
'@ + "`n$timeoutLine`ncd /home/lavie/kosame-dev-orchestra`nnpm run auto:dev -- $autoDevArgs`n"
$adBytes = [System.Text.Encoding]::UTF8.GetBytes($autoDevScript)
$adB64   = [Convert]::ToBase64String($adBytes)
Write-Host "  Executing on WSL (nvm)..." -ForegroundColor $CYAN

$exitCode = 0
try {
  & wsl.exe -d Ubuntu -u lavie -- bash -lc "echo '$adB64' | base64 -d | bash -s"
  $exitCode = $LASTEXITCODE
} catch {
  Write-Host "ERROR: Auto-dev failed: $_" -ForegroundColor $RED
  $exitCode = 1
}

# ---- Stop relay ----
if ($relayPid) {
  & wsl.exe -d Ubuntu -u lavie -- bash -lc "kill $relayPid 2>/dev/null; exit 0"
  Write-Host "  Relay stopped (PID: $relayPid)" -ForegroundColor $GRAY
}

Write-Host ""
if ($exitCode -eq 0) {
  Write-Host "  Auto-Dev completed successfully." -ForegroundColor $GREEN
} else {
  Write-Host "  Auto-Dev exited with code $exitCode" -ForegroundColor $RED
}
exit $exitCode