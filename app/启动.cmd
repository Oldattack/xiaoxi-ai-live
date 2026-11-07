@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem --quiet：由 启动.vbs 调起，完全不显示窗口
set QUIET=0
if /i "%~1"=="--quiet" set QUIET=1

if "%QUIET%"=="0" (
  echo.
  echo   ==========================================
  echo     小汐AI直播平台
  echo   ==========================================
  echo.
)

where node >nul 2>nul
if errorlevel 1 (
  if "%QUIET%"=="1" (
    echo [%date% %time%] 没找到 Node.js >> "%~dp0launcher.log"
  ) else (
    echo  [!] 没找到 Node.js，请先装：https://nodejs.org
    pause
  )
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
if "%QUIET%"=="0" echo  [OK] Node.js !NODEVER!

rem DSH 检查（装了就把插件登记好）—— 静默模式下结果写日志
if "%QUIET%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0dsh-check.ps1" >> "%~dp0launcher.log" 2>&1
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dsh-check.ps1"
  echo.
)

rem 已经在跑？直接开页面
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8792/health' -TimeoutSec 2; if ($r.ok) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
  if "%QUIET%"=="1" (
    start "" /b wscript //nologo "%~dp0open-browser.vbs" "http://127.0.0.1:8792"
  ) else (
    echo  [OK] 服务已在运行
    start "" "http://127.0.0.1:8792/settings"
    echo.
    echo  要停止：双击「停止.vbs」，或设置页右上角「关闭服务」
    timeout /t 5 /nobreak >nul
  )
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
  if "%QUIET%"=="1" (
    echo [%date% %time%] 端口都被占用 >> "%~dp0launcher.log"
  ) else (
    echo  [!] 端口都被占用了，关掉别的程序再试
    pause
  )
  exit /b 1
)

rem 后台等就绪再开浏览器（无窗口）
start "" /b wscript //nologo "%~dp0open-browser.vbs" "http://127.0.0.1:!PORT!"

if "%QUIET%"=="0" (
  echo  [OK] 端口 !PORT!
  echo.
  echo  ==========================================
  echo    服务在这个窗口里运行
  echo.
  echo    ★ 关掉这个窗口 = 停止服务（她就不说话了）
  echo    ★ 或者点设置页右上角「关闭服务」
  echo  ==========================================
  echo.
)

node supervisor.mjs --port !PORT!

if "%QUIET%"=="0" (
  echo.
  echo  服务已停止。
  timeout /t 3 /nobreak >nul
)
