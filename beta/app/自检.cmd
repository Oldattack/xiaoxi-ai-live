@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo.
echo   ==========  小汐AI直播平台 · 自检  ==========
echo.
echo   目录：%~dp0
echo.

rem 本安装目录自己的端口：上一次实际用的端口（runtime.json）且还健康 > config.json 的 port > 8792
set OWNPORT=
for /f "delims=" %%p in ('powershell -NoProfile -Command "$p=0; try { $raw=Get-Content '%~dp0runtime.json' -Raw -Encoding UTF8 -ErrorAction Stop; if ($raw -and $raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw=$raw.Substring(1) }; $rt=$raw | ConvertFrom-Json; if ($rt.port) { $rp=[int]$rt.port; try { $r=Invoke-RestMethod ('http://127.0.0.1:' + $rp + '/health') -TimeoutSec 2; if ($r.ok) { $p=$rp } } catch {} } } catch {}; if ($p -eq 0) { try { $raw2=Get-Content '%~dp0config.json' -Raw -Encoding UTF8 -ErrorAction Stop; if ($raw2 -and $raw2.Length -gt 0 -and $raw2[0] -eq [char]0xFEFF) { $raw2=$raw2.Substring(1) }; $c=$raw2 | ConvertFrom-Json; if ($c.port) { $p=[int]$c.port } } catch {} }; if ($p -eq 0) { $p=8792 }; [string]$p"') do set OWNPORT=%%p
set OWNPORT=!OWNPORT: =!
if not defined OWNPORT set OWNPORT=8792
echo   本实例端口：!OWNPORT!

echo.
echo   [1] Node.js
where node >nul 2>nul
if errorlevel 1 ( echo        x 没装 Node.js  https://nodejs.org ) else (
  for /f "tokens=*" %%v in ('node -v') do echo        v %%v
)

echo.
echo   [2] 关键文件
for %%f in (xiaoxi.mjs server.mjs supervisor.mjs settings.html scene.html config.json VERSION) do (
  if exist "%%f" ( echo        v %%f ) else ( echo        - %%f 不存在 )
)

echo.
echo   [3] 端口占用（本实例 !OWNPORT! + 常见端口）
for %%p in (!OWNPORT! 8792 8793 8794 8795 8796 8798) do (
  powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %%p); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 ( echo        %%p 被占用 ) else ( echo        %%p 空闲 )
)

echo.
echo   [4] 服务是否响应（本实例 !OWNPORT!）
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:!OWNPORT!/health' -TimeoutSec 3; Write-Host ('        v 正常  版本=' + (Invoke-RestMethod 'http://127.0.0.1:!OWNPORT!/api/update').version) } catch { Write-Host '        x 没响应' }"

echo.
echo   [5] 防火墙 / 局域网（别人要访问才需要）
powershell -NoProfile -Command "Get-NetFirewallRule -DisplayName '*node*' -ErrorAction SilentlyContinue | Select-Object -First 3 DisplayName,Enabled | Format-Table -AutoSize | Out-String" 2>nul

echo.
echo   [6] 最近日志
if exist "supervisor.log" (
  powershell -NoProfile -Command "Get-Content 'supervisor.log' -Tail 10 -Encoding UTF8"
) else (
  echo        还没有日志（可能从没启动过）
)

echo.
echo   ============================================
echo   把这一整屏截图发给技术支持即可。
echo.
pause
