@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   ==========================================
echo     小汐AI直播平台
echo   ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [!] 没找到 Node.js，请先装：https://nodejs.org
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
echo  [OK] Node.js !NODEVER!

rem 已经在跑？
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8792/health' -TimeoutSec 2; if ($r.ok) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
  echo  [OK] 服务已在运行
  start "" "http://127.0.0.1:8792/settings"
  echo.
  echo  要停止：双击「停止.cmd」
  timeout /t 4 /nobreak >nul
  exit /b 0
)

rem 找空闲端口
set PORT=
for %%p in (8792 8793 8794 8795 8796) do (
  if not defined PORT (
    powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %%p); $c.Close(); exit 1 } catch { exit 0 }" >nul 2>nul
    if not errorlevel 1 set PORT=%%p
  )
)
if not defined PORT (
  echo  [!] 端口都被占用了，关掉别的程序再试
  pause
  exit /b 1
)
echo  [OK] 端口 !PORT!

rem 后台等就绪再开浏览器（独立进程，不阻塞）
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 40; $i++) { try { $r = Invoke-RestMethod 'http://127.0.0.1:!PORT!/health' -TimeoutSec 2; if ($r.ok) { Start-Process 'http://127.0.0.1:!PORT!/settings'; break } } catch {} ; Start-Sleep -Milliseconds 800 }"

echo.
echo  ==========================================
echo    服务在这个窗口里运行
echo.
echo    ★ 关掉这个窗口 = 停止服务（她就不说话了）
echo    ★ 或者双击「停止.cmd」
echo  ==========================================
echo.

node supervisor.mjs --port !PORT!

echo.
echo  服务已停止。
timeout /t 3 /nobreak >nul
