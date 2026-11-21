# 小汐AI直播平台 · 停止服务
# 只停「本安装目录」的实例：runtime.json（守护启动时写的 pid/port）→ config.json 的 port。
# 读不到端口就不按端口杀（绝不回退到 8792，避免误杀同机另一套），只放 stop.flag 让本目录守护自己退出。
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $here) { $here = (Get-Location).Path }
Set-Location $here

Write-Host ''
Write-Host '  小汐AI直播平台 · 停止服务'
Write-Host '  ------------------------------------'

# PowerShell 5.1 里 String.Replace([char]0xFEFF, '') 会绑到 (char, char) 重载并抛异常，
# 进而让下面读配置失败 → 端口回退 8792 → 误杀同机另一套。这里手工去 BOM。
function Read-JsonRelaxed([string]$path) {
  try {
    $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8 -ErrorAction Stop
    if ($null -eq $raw) { return $null }
    $raw = [string]$raw
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
    return (ConvertFrom-Json $raw)
  } catch { return $null }
}

# 1) 先放停止标记，让本目录守护别再自动重启
try { Set-Content -Path (Join-Path $here 'stop.flag') -Value 'stop' -Encoding UTF8 } catch {}

# 2) 端口与守护 PID：runtime.json > config.json（都失败就只靠 stop.flag）
$port = 0
$portKnown = $false
$supPid = 0
$runtime = Join-Path $here 'runtime.json'
$j = Read-JsonRelaxed $runtime
if ($j) {
  if ($j.port) {
    $n = 0
    if ([int]::TryParse([string]$j.port, [ref]$n) -and $n -gt 0) { $port = $n; $portKnown = $true }
  }
  if ($j.pid) {
    $n2 = 0
    if ([int]::TryParse([string]$j.pid, [ref]$n2) -and $n2 -gt 0) { $supPid = $n2 }
  }
}
if (-not $portKnown) {
  $c = Read-JsonRelaxed (Join-Path $here 'config.json')
  if ($c -and $c.port) {
    $n3 = 0
    if ([int]::TryParse([string]$c.port, [ref]$n3) -and $n3 -gt 0) { $port = $n3; $portKnown = $true }
  }
}

function Kill-Tree([int]$id) {
  if ($id -le 0) { return }
  Write-Host ('  [..] 结束进程 ' + $id)
  try { & taskkill /PID $id /T /F 2>$null | Out-Null } catch { }
}

$stoppedAny = $false

# 2.1 按 runtime.json 的守护 PID 停（连同它拉起的服务）
if ($supPid -gt 0) {
  try {
    $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $supPid) -ErrorAction Stop
    if ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'supervisor\.mjs') {
      Kill-Tree $supPid
      $stoppedAny = $true
    }
  } catch { }
}

# 2.2 端口兜底：只在真的读到端口时做（读不到绝不去动 8792 之类的默认端口）
if ($portKnown) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn -and $conn.OwningProcess) {
      $lp = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $conn.OwningProcess) -ErrorAction SilentlyContinue
      if ($lp -and $lp.Name -eq 'node.exe' -and $lp.CommandLine -match 'xiaoxi\.mjs|server\.mjs') {
        $parent = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $lp.ParentProcessId) -ErrorAction SilentlyContinue
        if ($parent -and $parent.CommandLine -match 'supervisor\.mjs') { Kill-Tree $parent.ProcessId } else { Kill-Tree $conn.OwningProcess }
        $stoppedAny = $true
      }
    }
  } catch { }
}

if ($stoppedAny) {
  Write-Host '  [OK] 已停止'
} elseif (-not $portKnown) {
  Write-Host '  [OK] 已放停止标记（没读到端口，本目录的守护会自己退出）'
} else {
  Write-Host '  [OK] 没有正在运行的服务'
}

# 3) 清理运行时记录；**停止标记要留下**：
#    DSH 插件的 ensureService 每分钟巡检一次，靠 stop.flag 判断“用户主动停止”而不自动拉起；
#    启动动作（启动.cmd / 插件「启动服务」）会清掉它。这里删了的话服务 1 分钟内又会被插件拉起来。
Start-Sleep -Milliseconds 800
try { Remove-Item $runtime -Force -ErrorAction SilentlyContinue } catch { }
Write-Host '  [OK] 已保留停止标记（下次「启动」会自动清除）'

# 4) 确认（只看本实例端口；不知道端口就不猜）
$still = $false
if ($portKnown) {
  try {
    $r = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/health') -TimeoutSec 2
    if ($r.ok) { $still = $true }
  } catch { }
}
Write-Host ''
if ($still) { Write-Host ('  [!] 端口 ' + $port + ' 还有响应，可能另一个实例还在跑') }
elseif ($portKnown) { Write-Host '  她不会再说话了。' }
else { Write-Host '  已发送停止标记。' }
Write-Host ''
