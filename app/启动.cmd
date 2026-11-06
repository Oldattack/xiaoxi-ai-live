@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 没找到 Node.js，请先装 https://nodejs.org 的 LTS 版本
  pause
  exit /b 1
)
echo 正在启动小汐AI直播平台...
start "小汐AI直播平台" cmd /c "cd /d %~dp0 && node supervisor.mjs"
timeout /t 6 /nobreak >nul
start "" "http://127.0.0.1:8792/settings"
