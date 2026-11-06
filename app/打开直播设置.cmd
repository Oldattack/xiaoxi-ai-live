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
  echo  [!] 没找到 Node.js
  echo      请先装：https://nodejs.org （LTS 版本）
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
echo  [OK] Node.js !NODEVER!

rem 已经在跑？
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8792/health' -TimeoutSec 2; if ($r.ok) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
  echo  [OK] 服务已经在运行
  start "" "http://127.0.0.1:8792/settings"
  echo.
  echo  要停止服务：双击「停止.cmd」
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
  echo  [!] 8792~8796 都被占用了，请关掉别的程序再试
  pause
  exit /b 1
)
echo  [OK] 端口 !PORT!
echo.

rem 后台任务：等服务就绪后开浏览器
start "" /b cmd /c "chcp 65001 >nul & for /l %%%%i in (1,1,40) do ( powershell -NoProfile -Command \"try { $r = Invoke-RestMethod 'http://127.0.0.1:!PORT!/health' -TimeoutSec 2; if ($r.ok) { exit 0 } } catch {}; exit 1\" >nul 2>nul & if not errorlevel 1 ( start \"\" http://127.0.0.1:!PORT!/settings & exit /b 0 ) & ping -n 2 127.0.0.1 >nul )"

echo  ==========================================
echo    服务正在这个窗口里运行
echo.
echo    ★ 要停止：直接关掉这个窗口，或双击「停止.cmd」
echo    ★ 别最小化后忘记它——窗口在，她就还在说话
echo  ==========================================
echo.

rem 前台运行：关掉窗口 = 进程结束 = 不再说话
node supervisor.mjs --port !PORT!

echo.
echo  服务已停止。
timeout /t 3 /nobreak >nul
