<#
.SYNOPSIS
  KOSAME Auto-Dev PowerShell Launcher v110.45.0
  Invokes auto-dev on WSL and relays progress to Cloud Run Dashboard.

.DESCRIPTION
  This script:
    1. Pre-flight checks (WSL, Node, Claude CLI, project, API key, Cloud Run)
    2. Starts kosame-activity-relay.js on WSL (background)
    3. Runs npm run auto:dev on WSL with the given spec
    4. Displays live PID, taskId, project
    5. Returns exit code from auto-dev

.PARAMETER SpecFile
  Path to the product specification file (Windows path).

.PARAMETER Project
  Target project name (e.g. anesty-board, kosame-dev-orchestra).

.PARAMETER DryRun
  If set, runs auto-dev in dry-run mode (default).

.PARAMETER CloudRunUrl
  KOSAME Cloud Run Dashboard URL (e.g. https://kosame-dashboard-xxxx-an.a.run.app).

.PARAMETER KosameApiKey
  KOSAME API key for Cloud Run authentication.
  If omitted, reads $env:KOSAME_API_KEY from PowerShell environment.

.EXAMPLE
  .\tools\Invoke-KosameAutoDev.ps1 -SpecFile "C:\specs\feature.md" -Project "anesty-board" -DryRun

.EXAMPLE
  $env:KOSAME_API_KEY = "your-key"
  .\tools\Invoke-KosameAutoDev.ps1 -SpecFile "C:\specs\feature.md" -Project "anesty-board"
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$SpecFile,

  [Parameter(Mandatory = $true)]
  [string]$Project,

  [switch]$DryRun = $true,

  [string]$CloudRunUrl = "",

  [string]$KosameApiKey = ""
)

$ErrorActionPreference = "Stop"

# ── Colors ──────────────────────────────────────────────────────────────────
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
      Write-Host ("         → " + $action) -ForegroundColor $YELLOW
    }
    return $false
  }
}

$allOk = $true

# ── 1. WSL ──────────────────────────────────────────────────────────────────
$wslAvailable = $false
try {
  $wslVersion = & wsl --version 2>&1
  $wslAvailable = $LASTEXITCODE -eq 0
} catch {}
if (-not (PreCheck "WSL が利用可能です" $wslAvailable "WSL をインストールしてください: wsl --install")) {
  $allOk = $false
}

$wslPrefix = "~/kosame-dev-orchestra"

# ── 2. KOSAME directory on WSL ──────────────────────────────────────────────
$wslDirExists = $false
if ($wslAvailable) {
  try {
    $wslDirExists = (& wsl bash -c "[ -d ~/kosame-dev-orchestra ] && echo yes") -eq "yes"
  } catch {}
}
if (-not (PreCheck "WSL 上に ~/kosame-dev-orchestra が存在します" $wslDirExists "WSL で git clone https://github.com/shimohigoshi-afk/kosame-dev-orchestra.git ~/kosame-dev-orchestra")) {
  $allOk = $false
}

# ── 3. Node.js on WSL ───────────────────────────────────────────────────────
$nodeOk = $false
if ($wslAvailable) {
  try {
    $nodeVer = & wsl bash -c "node --version 2>/dev/null"
    $nodeOk = $LASTEXITCODE -eq 0 -and $nodeVer -match "^v"
  } catch {}
}
if (-not (PreCheck "WSL Node.js が利用可能です ($nodeVer)" $nodeOk "WSL で Node.js をインストール: https://nodejs.org")) {
  $allOk = $false
}

# ── 4. npm on WSL ───────────────────────────────────────────────────────────
$npmOk = $false
$npmVer = ""
if ($wslAvailable) {
  try {
    $npmVer = & wsl bash -c "npm --version 2>/dev/null"
    $npmOk = $LASTEXITCODE -eq 0
  } catch {}
}
if (-not (PreCheck "WSL npm が利用可能です ($npmVer)" $npmOk "WSL で npm install -g npm")) {
  $allOk = $false
}

# ── 5. Claude CLI on WSL ────────────────────────────────────────────────────
$claudeExists = $false
$claudeVer = ""
if ($wslAvailable) {
  try {
    $claudeVer = & wsl bash -c "claude --version 2>/dev/null"
    $claudeExists = $LASTEXITCODE -eq 0
  } catch {}
}
if (-not (PreCheck "WSL Claude CLI が利用可能です ($claudeVer)" $claudeExists "WSL で npm install -g @anthropic-ai/claude-code")) {
  $allOk = $false
}

# ── 6. Claude --print available ─────────────────────────────────────────────
$claudePrintOk = $false
if ($wslAvailable -and $claudeExists) {
  try {
    # Quick test: claude --print "hi" with short timeout
    $printResult = & wsl bash -c "timeout 5 claude --print 'say ok' 2>/dev/null"
    $claudePrintOk = $LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 124  # 124=timeout is OK for session rate-limit check
  } catch {}
}
if (-not $claudePrintOk) {
  # Check if it's a session/rate limit
  try {
    $errMsg = & wsl bash -c "claude --print 'hi' 2>&1; exit 0"
    if ($errMsg -match "rate.?limit|session.?limit|quota|429") {
      Write-Host "  [RATE_LIMIT] Claude CLI session limit — wait and retry later" -ForegroundColor $YELLOW
      $allOk = $false
    } else {
      if (-not (PreCheck "Claude --print が利用可能です" $false "Claude CLI の認証状態を確認: claude --print 'test'")) {
        $allOk = $false
      }
    }
  } catch {
    if (-not (PreCheck "Claude --print が利用可能です" $false "Claude CLI の認証状態を確認: claude --print 'test'")) {
      $allOk = $false
    }
  }
} else {
  Write-Host "  [PASS] Claude --print が利用可能です" -ForegroundColor $GREEN
}

# ── 7. package.json auto:dev script ─────────────────────────────────────────
$autoDevScriptOk = $false
if ($wslAvailable -and $wslDirExists) {
  try {
    $hasScript = & wsl bash -c "cd ~/kosame-dev-orchestra && node -e 'const p=require(\"./package.json\"); process.exit(p.scripts?.auto?dev?0:1)'"
    $autoDevScriptOk = $LASTEXITCODE -eq 0
  } catch {}
}
if (-not (PreCheck "package.json に auto:dev が定義されています" $autoDevScriptOk "package.json scripts を確認")) {
  $allOk = $false
}

# ── 8. Spec file exists ─────────────────────────────────────────────────────
$specOk = Test-Path -LiteralPath $SpecFile -PathType Leaf
if (-not (PreCheck "SpecFile が存在します" $specOk "SpecFile のパスを確認: $SpecFile")) {
  $allOk = $false
}

# ── 9. Project validation ───────────────────────────────────────────────────
# Allowed projects: check against PROJECTS in kosame-dashboard-server.js
$allowedProjects = @("kosame-dev-orchestra", "anesty-board")
$projectOk = $allowedProjects -contains $Project
if (-not (PreCheck "Project が許可された値です ($($allowedProjects -join ', '))" $projectOk "Project は $($allowedProjects -join ' / ') のいずれかにしてください")) {
  $allOk = $false
}

# ── 10. KOSAME_API_KEY ──────────────────────────────────────────────────────
if (-not $KosameApiKey) {
  $KosameApiKey = $env:KOSAME_API_KEY
}
$apiKeyOk = (-not [string]::IsNullOrEmpty($KosameApiKey))
$apiKeyMsg = if ($apiKeyOk) { "設定済み (値は表示しません)" } else { "未設定" }
if (-not (PreCheck "KOSAME_API_KEY が設定されています ($apiKeyMsg)" $apiKeyOk "-KosameApiKey 引数または `$env:KOSAME_API_KEY を設定")) {
  $allOk = $false
}

# ── 11. Cloud Run URL ───────────────────────────────────────────────────────
if (-not $CloudRunUrl) {
  $CloudRunUrl = $env:KOSAME_CLOUD_RUN_URL
}
$crUrlOk = (-not [string]::IsNullOrEmpty($CloudRunUrl))
if (-not (PreCheck "KOSAME_CLOUD_RUN_URL が設定されています" $crUrlOk "-CloudRunUrl 引数または `$env:KOSAME_CLOUD_RUN_URL を設定")) {
  $allOk = $false
}

# ── 12. Cloud Run /health reachable ─────────────────────────────────────────
$healthOk = $false
if ($crUrlOk) {
  try {
    $healthResp = & wsl bash -c "curl -s -o /dev/null -w '%{http_code}' --max-time 10 '$CloudRunUrl/health' 2>/dev/null"
    $healthOk = $healthResp -eq "200"
  } catch {}
}
if (-not (PreCheck "Cloud Run /health に到達可能です" $healthOk "Cloud Run サービスが稼働しているか確認: $CloudRunUrl")) {
  $allOk = $false
}

# ── Halt on failure ─────────────────────────────────────────────────────────
if (-not $allOk) {
  Write-Host ""
  Write-Host "Pre-flight checks failed. Fix the issue above and retry." -ForegroundColor $RED
  exit 1
}

Write-Host ""
Write-Host "All pre-flight checks passed." -ForegroundColor $GREEN
Write-Host ""

# ── Convert Windows path to WSL path ────────────────────────────────────────
$wslSpecPath = & wsl wslpath -u "$(Resolve-Path $SpecFile)" 2>$null
if (-not $wslSpecPath) {
  $absPath = (Resolve-Path $SpecFile).Path
  $wslSpecPath = "/mnt/$($absPath -replace '^([A-Z]):\\', '$1/' -replace '\\', '/')"
}
Write-Host "  WSL spec path: $wslSpecPath" -ForegroundColor $GRAY

# ── Build relay env ─────────────────────────────────────────────────────────
$relayEnv = "KOSAME_CLOUD_RUN_URL=""$CloudRunUrl"" KOSAME_API_KEY=""$KosameApiKey"""

# ── Start activity relay in background (WSL) ───────────────────────────────
Write-Host "  Starting activity relay on WSL..." -ForegroundColor $CYAN
$relayCmd = "cd $wslPrefix && $relayEnv node tools/kosame-activity-relay.js &"
$relayPid = & wsl bash -c "$relayCmd; echo `$!"
Write-Host "  Relay PID: $relayPid" -ForegroundColor $GRAY

# ── Build auto-dev arguments ────────────────────────────────────────────────
$autoDevArgs = "--file=""$wslSpecPath"" --project=""$Project"""
if ($DryRun) {
  $autoDevArgs += " --json"
} else {
  $autoDevArgs += " --write --json"
}

# ── Run auto-dev on WSL ────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor $GREEN
Write-Host "  KOSAME Auto-Dev" -ForegroundColor $GREEN
Write-Host "  Project : $Project" -ForegroundColor $GREEN
Write-Host "  DryRun  : $DryRun" -ForegroundColor $GREEN
Write-Host "  Spec    : $SpecFile" -ForegroundColor $GREEN
Write-Host "============================================" -ForegroundColor $GREEN
Write-Host ""

$autoDevEnv = "CLAUDE_TIMEOUT_MS=$($env:CLAUDE_TIMEOUT_MS)"
$autoDevCmd = "cd $wslPrefix && $autoDevEnv npm run auto:dev -- $autoDevArgs"
Write-Host "  Executing: npm run auto:dev on WSL..." -ForegroundColor $CYAN

$exitCode = 0
try {
  & wsl bash -c $autoDevCmd
  $exitCode = $LASTEXITCODE
} catch {
  Write-Host "ERROR: Auto-dev execution failed: $_" -ForegroundColor $RED
  $exitCode = 1
}

# ── Stop relay ──────────────────────────────────────────────────────────────
if ($relayPid) {
  & wsl bash -c "kill $relayPid 2>/dev/null; exit 0"
  Write-Host "  Relay stopped (PID: $relayPid)" -ForegroundColor $GRAY
}

Write-Host ""
if ($exitCode -eq 0) {
  Write-Host "  Auto-Dev completed successfully." -ForegroundColor $GREEN
} else {
  Write-Host "  Auto-Dev exited with code $exitCode" -ForegroundColor $RED
}
exit $exitCode
