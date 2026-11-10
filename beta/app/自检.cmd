@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo   ==========  小汐AI直播平台 · 自检  ==========
echo.
echo   目录：%~dp0
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
echo   [3] 端口占用
for %%p in (8792 8793 8794 8795) do (
  powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %%p); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 ( echo        %%p 被占用 ) else ( echo        %%p 空闲 )
)

echo.
echo   [4] 服务是否响应
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8792/health' -TimeoutSec 3; Write-Host ('        v 正常  版本=' + (Invoke-RestMethod 'http://127.0.0.1:8792/api/update').version) } catch { Write-Host '        x 没响应' }"

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
