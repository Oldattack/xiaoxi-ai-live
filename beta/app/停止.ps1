# 小汐AI直播平台 · 停止服务
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

Write-Host ''
Write-Host '  小汐AI直播平台 · 停止服务'
Write-Host '  ------------------------------------'

# 1) 先放停止标记，让守护别再自动重启
try { Set-Content -Path (Join-Path $here 'stop.flag') -Value 'stop' -Encoding UTF8 } catch {}

# 2) 找出所有相关 node 进程
$procs = @()
try {
  $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'supervisor\.mjs|xiaoxi\.mjs|server\.mjs' }
} catch {}

if (-not $procs -or $procs.Count -eq 0) {
  Write-Host '  [OK] 没有正在运行的服务'
} else {
  foreach ($p in $procs) {
    Write-Host ("  [..] 结束进程 " + $p.ProcessId)
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {
      try { & taskkill /PID $p.ProcessId /T /F 2>$null | Out-Null } catch {}
    }
  }
  Start-Sleep -Milliseconds 800
  $left = @()
  try {
    $left = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object { $_.CommandLine -match 'supervisor\.mjs|xiaoxi\.mjs|server\.mjs' }
  } catch {}
  if ($left -and $left.Count -gt 0) {
    Write-Host ('  [!] 还有 ' + $left.Count + ' 个没结束，再试一次…')
    foreach ($p in $left) { try { & taskkill /PID $p.ProcessId /T /F 2>$null | Out-Null } catch {} }
    Start-Sleep -Milliseconds 800
  }
  Write-Host '  [OK] 已停止'
}

# 3) 清理标记
Start-Sleep -Milliseconds 500
try { Remove-Item (Join-Path $here 'stop.flag') -Force -ErrorAction SilentlyContinue } catch {}

# 4) 确认
$still = $false
try {
  $r = Invoke-RestMethod 'http://127.0.0.1:8792/health' -TimeoutSec 2
  if ($r.ok) { $still = $true }
} catch {}
Write-Host ''
if ($still) { Write-Host '  [!] 8792 还有响应，可能另一个实例在跑' }
else { Write-Host '  她不会再说话了。' }
Write-Host ''
