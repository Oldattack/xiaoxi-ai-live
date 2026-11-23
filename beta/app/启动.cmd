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

rem ── 找 node.exe：包内 runtime > DSH 自带运行时 > 常见安装位置（含用户目录 / nvm）> PATH ──
rem 客户机不一定装了 Node，也可能装在 Program Files 之外；别只信 where node。
set "NODE_EXE="
if exist "%~dp0runtime\node.exe" set "NODE_EXE=%~dp0runtime\node.exe"
if not defined NODE_EXE if exist "%~dp0node.exe" set "NODE_EXE=%~dp0node.exe"
if not defined NODE_EXE for /d %%D in ("%USERPROFILE%\.dsh\dsh-runtimes\*") do (
  if not defined NODE_EXE if exist "%%~fD\dependencies\node\bin\node.exe" set "NODE_EXE=%%~fD\dependencies\node\bin\node.exe"
)
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%APPDATA%\nvm\node.exe" set "NODE_EXE=%APPDATA%\nvm\node.exe"
if not defined NODE_EXE for /f "delims=" %%P in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%P"

if not defined NODE_EXE (
  if "%QUIET%"=="1" (
    echo [%date% %time%] 没找到 node.exe >> "%~dp0launcher.log"
  ) else (
    echo  [!] 没找到 node.exe
    echo      装个 Node.js LTS：https://nodejs.org  （装完重开就行）
    pause
  )
  exit /b 1
)
if "%QUIET%"=="0" echo  [OK] !NODE_EXE!

rem DSH 检查（装了就把插件登记好）—— 静默模式下结果写日志
if "%QUIET%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0dsh-check.ps1" >> "%~dp0launcher.log" 2>&1
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dsh-check.ps1"
  echo.
)

rem 本安装目录自己的端口：**上一次实际用的端口（runtime.json）且还健康 > config.json 的 port > 8792**
rem 同机可能装两套（完整版 + 商家版），绝不能写死 8792 去探别人的实例；
rem 也不能只看 config：上一次可能因为端口被占而扫描到了别的端口，这里再启动会起出第二个实例。
set OWNPORT=
for /f "delims=" %%p in ('powershell -NoProfile -Command "$p=0; try { $raw=Get-Content '%~dp0runtime.json' -Raw -Encoding UTF8 -ErrorAction Stop; if ($raw -and $raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw=$raw.Substring(1) }; $rt=$raw | ConvertFrom-Json; if ($rt.port) { $rp=[int]$rt.port; try { $r=Invoke-RestMethod ('http://127.0.0.1:' + $rp + '/health') -TimeoutSec 2; if ($r.ok) { $p=$rp } } catch {} } } catch {}; if ($p -eq 0) { try { $raw2=Get-Content '%~dp0config.json' -Raw -Encoding UTF8 -ErrorAction Stop; if ($raw2 -and $raw2.Length -gt 0 -and $raw2[0] -eq [char]0xFEFF) { $raw2=$raw2.Substring(1) }; $c=$raw2 | ConvertFrom-Json; if ($c.port) { $p=[int]$c.port } } catch {} }; if ($p -eq 0) { $p=8792 }; [string]$p"') do set OWNPORT=%%p
set OWNPORT=!OWNPORT: =!
if not defined OWNPORT set OWNPORT=8792
if "%QUIET%"=="0" echo  [..] 本实例端口 !OWNPORT!

rem 已经在自己的端口跑？直接开自己的页面
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:!OWNPORT!/health' -TimeoutSec 2; if ($r.ok) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
  if "%QUIET%"=="1" (
    start "" /b wscript //nologo "%~dp0open-browser.vbs" "http://127.0.0.1:!OWNPORT!"
  ) else (
    echo  [OK] 服务已在运行（端口 !OWNPORT!）
    start "" "http://127.0.0.1:!OWNPORT!/settings"
    echo.
    echo  要停止：双击「停止.vbs」，或设置页右上角「关闭服务」
    ping -n 6 127.0.0.1 >nul
  )
  exit /b 0
)

rem 先试自己的端口；被别的程序占了再从 8792~8800 找空闲
set PORT=
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', !OWNPORT!); $c.Close(); exit 1 } catch { exit 0 }" >nul 2>nul
if not errorlevel 1 set PORT=!OWNPORT!
if not defined PORT (
  for %%p in (8792 8793 8794 8795 8796 8797 8798 8799 8800) do (
    if not defined PORT (
      powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %%p); $c.Close(); exit 1 } catch { exit 0 }" >nul 2>nul
      if not errorlevel 1 set PORT=%%p
    )
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

rem 上次「停止」如果没来得及收尾会留下 stop.flag，supervisor 一起来看到它就退出；
rem 所以必须在拉起 supervisor 之前清掉，否则浏览器会开到一个已经死掉的页面。
if exist "%~dp0stop.flag" del /f /q "%~dp0stop.flag"

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

if "%QUIET%"=="1" ( "%NODE_EXE%" supervisor.mjs --hidden --port !PORT! ) else ( "%NODE_EXE%" supervisor.mjs --port !PORT! )

if "%QUIET%"=="0" (
  echo.
  echo  服务已停止。
  ping -n 4 127.0.0.1 >nul
)
