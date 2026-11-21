# 小汐AI直播平台 · 自检（PowerShell 版）
# 由 自检.cmd 调用。以前所有检查都塞在 .cmd 里，UTF-8 长行会被 cmd 解析截断
# （曾出现 "Profile 不是内部或外部命令"），所以统一放到 ps1 里做。
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Line($t) { Write-Host $t }

Line ''
Line '  ==========  小汐AI直播平台 · 自检  =========='
Line ''
Line ('  目录：' + $here + '\')
Line ''

# ── 本实例端口：runtime.json（健康）> config.json > 8792 ──
function Read-JsonSafe($p) {
  try {
    $raw = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
    return $raw | ConvertFrom-Json
  } catch { return $null }
}
$ownPort = 0
$rt = Read-JsonSafe (Join-Path $here 'runtime.json')
if ($rt -and $rt.port) {
  $rp = [int]$rt.port
  try { $r = Invoke-RestMethod ('http://127.0.0.1:' + $rp + '/health') -TimeoutSec 2; if ($r.ok) { $ownPort = $rp } } catch {}
}
if ($ownPort -eq 0) {
  $c = Read-JsonSafe (Join-Path $here 'config.json')
  if ($c -and $c.port) { $ownPort = [int]$c.port }
}
# 读不到就如实说「不知道」，绝不回退 8792：同机可能还装着完整版，回退会把别人的实例当成自己的。
$portKnown = $ownPort -gt 0
if ($portKnown) { Line ('  本实例端口：' + $ownPort) } else { Line '  本实例端口：没读到（还没启动过？先运行「启动.cmd」）' }

# ── [1] Node ──
Line ''
Line '  [1] Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Line ('       ' + (& node -v 2>$null))
} else {
  Line '       x 没装 Node.js  https://nodejs.org'
}

# ── [2] 关键文件 ──
Line ''
Line '  [2] 关键文件'
$hasBundle = (Test-Path (Join-Path $here 'xiaoxi.mjs')) -or (Test-Path (Join-Path $here 'server.mjs'))
Line ('       ' + $(if ($hasBundle) { 'v' } else { 'x' }) + ' 主程序（xiaoxi.mjs / server.mjs）')
foreach ($f in @('supervisor.mjs', 'settings.html', 'scene.html', 'config.json', 'VERSION', 'plugin\package.json')) {
  $ok = Test-Path (Join-Path $here $f)
  Line ('       ' + $(if ($ok) { 'v ' + $f } else { 'x ' + $f + '  缺失' }))
}
$ver = ''
try { $ver = (Get-Content (Join-Path $here 'VERSION') -Raw -ErrorAction SilentlyContinue).Trim() } catch {}
if ($ver) { Line ('       版本号：' + $ver) }

# ── [3] 端口 ──
Line ''
Line ('  [3] 端口占用（' + $(if ($portKnown) { '本实例 ' + $ownPort + ' + ' } else { '' }) + '常见端口）')
$ports = @($ownPort, 8792, 8793, 8794, 8795, 8796, 8797, 8798) | Where-Object { $_ -gt 0 } | Select-Object -Unique
foreach ($p in $ports) {
  $busy = $false
  try { $tc = New-Object Net.Sockets.TcpClient; $tc.Connect('127.0.0.1', $p); $tc.Close(); $busy = $true } catch {}
  Line ('       ' + $p + ' ' + $(if ($busy) { '被占用' } else { '空闲' }))
}

# ── [4] 服务 ──
Line ''
Line ('  [4] 服务是否响应（' + $(if ($portKnown) { '本实例 ' + $ownPort } else { '端口未知' }) + '）')
$healthOk = $false
if ($portKnown) {
  try {
    $h = Invoke-RestMethod ('http://127.0.0.1:' + $ownPort + '/health') -TimeoutSec 3
    if ($h.ok) {
      $healthOk = $true
      $v2 = ''
      try { $v2 = (Invoke-RestMethod ('http://127.0.0.1:' + $ownPort + '/api/update') -TimeoutSec 3).version } catch {}
      Line ('       v 正常' + $(if ($v2) { '  版本=' + $v2 } else { '' }))
    }
  } catch {}
} else {
  Line '       - 跳过（不知道本实例端口，不猜 8792，免得把另一套当成自己）'
}
if ($portKnown -and -not $healthOk) { Line '       x 没响应（点「启动.cmd」或「启动.vbs」）' }

# ── [5] OBS ──
Line ''
Line '  [5] OBS'
$obsProc = @(Get-Process obs64 -ErrorAction SilentlyContinue)
Line ('       ' + $(if ($obsProc.Count -gt 0) { 'v OBS 进程在跑' } else { '- OBS 没打开（用直播伴侣抓画面时需要）' }))
$obsCfg = Join-Path $env:APPDATA 'obs-studio\plugin_config\obs-websocket\config.json'
if (Test-Path $obsCfg) {
  $oc = Read-JsonSafe $obsCfg
  $op = 4455
  if ($oc -and $oc.server_port) { $op = [int]$oc.server_port }
  $wsOk = $false
  try { $t2 = New-Object Net.Sockets.TcpClient; $t2.Connect('127.0.0.1', $op); $t2.Close(); $wsOk = $true } catch {}
  Line ('       ' + $(if ($wsOk) { 'v OBS WebSocket 端口 ' + $op + ' 可连' } else { '- OBS WebSocket 端口 ' + $op + ' 连不上（OBS 没开？）' }))
} else {
  Line '       - 没有 OBS 配置（还没装/没开过 OBS）'
}

# ── [6] 防火墙 ──
Line ''
Line '  [6] 防火墙 / 局域网（别人要访问才需要）'
try {
  $fr = Get-NetFirewallRule -DisplayName '*node*' -ErrorAction SilentlyContinue | Select-Object -First 3 DisplayName, Enabled | Format-Table -AutoSize | Out-String
  if ($fr.Trim()) { Write-Host $fr } else { Line '       - 没找到 Node.js 防火墙规则（本机用不影响）' }
} catch { Line '       - 查询不了防火墙（不影响本机使用）' }

# ── [7] 日志 ──
Line ''
Line '  [7] 最近日志'
$log = Join-Path $here 'supervisor.log'
if (Test-Path $log) {
  try { Get-Content $log -Tail 10 -Encoding UTF8 } catch { Line '       （日志读不出来，可能正被占用）' }
} else {
  Line '       还没有日志（可能从没启动过）'
}

Line ''
Line '  ============================================'
Line '  把这一整屏截图发给技术支持即可。'
