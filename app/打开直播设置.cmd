@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8792/api/state' -TimeoutSec 2; if ($r.ok) { exit 0 } } catch {}; exit 1"
if errorlevel 1 (
  echo  [..] 正在启动服务...
  start "小汐AI直播平台" /min cmd /c "node supervisor.mjs"
  timeout /t 4 /nobreak >nul
) else (
  echo  [OK] 服务已在运行
)
start "" "http://127.0.0.1:8792/settings"
