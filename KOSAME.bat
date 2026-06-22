@echo off
chcp 65001 >nul
title KOSAME Console

echo.
echo  -----------------------------------------------
echo   ☂️  KOSAME Console 起動中...
echo  -----------------------------------------------
echo.

:: ─── WSL 起動確認 ────────────────────────────────────────────────────────
wsl -d Ubuntu -e echo ok >nul 2>&1
if %errorlevel% neq 0 (
    echo  WSL を起動しています。少し待ってください...
    wsl --distribution Ubuntu --exec echo ok >nul 2>&1
    timeout /t 6 /nobreak >nul
)
echo  [1/4] WSL: 起動済み

:: ─── APIキーウィザード ────────────────────────────────────────────────────
wsl -d Ubuntu bash -lc "cd ~/kosame-dev-orchestra && bash tools/kosame-api-key-wizard.sh"

:: ─── cockpit:server 起動 ─────────────────────────────────────────────────
echo  [2/4] cockpit:server を起動します...
start "KOSAME cockpit:server" cmd /k "wsl -d Ubuntu bash -lc ""cd ~/kosame-dev-orchestra && npm run cockpit:server"""

:: ─── Runner watcher 起動 ─────────────────────────────────────────────────
echo  [3/4] Runner watcher を起動します...
start "KOSAME Runner watcher" cmd /k "wsl -d Ubuntu bash -lc ""cd ~/kosame-dev-orchestra && npm run runner:watch"""

:: ─── サーバー起動待ち（/healthz が応答するまで最大 60 秒） ──────────────
echo  [4/4] サーバー起動確認中...
set /a tries=0
:wait_loop
set /a tries+=1
if %tries% gtr 30 (
    echo  タイムアウト — ブラウザを開きます。
    goto open_browser
)
timeout /t 2 /nobreak >nul
wsl -d Ubuntu bash -c "curl -sf http://localhost:8080/healthz" >nul 2>&1
if %errorlevel% neq 0 goto wait_loop

echo  サーバー起動完了！

:: ─── ブラウザを開く ──────────────────────────────────────────────────────
:open_browser
start "" "http://localhost:8080"

echo.
echo  -----------------------------------------------
echo   ☂️  起動完了！
echo      http://localhost:8080
echo  -----------------------------------------------
echo.
echo  このウィンドウはそのまま開いておいてください。
echo  閉じるとサーバーが停止します。
echo.
