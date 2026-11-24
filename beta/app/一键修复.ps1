# 小汐 AI 直播平台 · 一键修复
#
# 用法（任选其一）：
#   1) 双击 一键修复.cmd
#   2) 对 AI 说一句「帮我修一下小汐」→ AI 让你运行这一行：
#        powershell -ExecutionPolicy Bypass -File 一键修复.ps1
#   3) 只想看不动手：加 -DryRun
#
# 原则：
#   · 先诊断，只修「确实有问题」的项，健康系统不会被动到
#   · 任何破坏性动作（重置配置 / 换端口 / 重启服务）都会先备份
#   · 修不了的项会整理成一段话复制到剪贴板，客户直接粘给 AI

param(
  [switch]$DryRun,
  [switch]$NoPause
)

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

$Log = New-Object System.Collections.ArrayList
$Fixed = New-Object System.Collections.ArrayList
$Manual = New-Object System.Collections.ArrayList

function Say($t, $color) {
  if ($color) { Write-Host $t -ForegroundColor $color } else { Write-Host $t }
  [void]$Log.Add($t)
}
function Sec($t) { Say ''; Say ('─' * 58) ('DarkGray'); Say ('  ' + $t) ('Cyan'); Say ('─' * 58) ('DarkGray') }
function Did($t) { Say ('  ✅ ' + $t) ('Green'); [void]$Fixed.Add($t) }
function Need($t, $hint) { Say ('  ⚠️  ' + $t) ('Yellow'); [void]$Manual.Add($t + $(if ($hint) { '  → ' + $hint } else { '' })) }
function Info($t) { Say ('  · ' + $t) ('Gray') }

# ─────────── 定位安装目录 ───────────
function Find-InstallDir {
  $here = Split-Path -Parent $MyInvocation.MyCommand.Path
  $cands = @()
  if ($here) { $cands += (Split-Path -Parent $here); $cands += $here }
  $cands += @('D:\xiaoxi-ai-live', 'C:\xiaoxi-ai-live', 'E:\xiaoxi-ai-live')
  if ($env:XIAOXI_HOME) { $cands = @($env:XIAOXI_HOME) + $cands }
  foreach ($c in $cands) {
    if (-not $c) { continue }
    if ((Test-Path (Join-Path $c 'xiaoxi.mjs')) -or (Test-Path (Join-Path $c 'server.mjs'))) { return $c }
  }
  try {
    $p = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object { $_.CommandLine -match 'xiaoxi\.mjs' } | Select-Object -First 1
    if ($p) {
      $m = [regex]::Match($p.CommandLine, '"?([A-Za-z]:\\[^"]*?)\\xiaoxi\.mjs')
      if ($m.Success -and (Test-Path $m.Groups[1].Value)) { return $m.Groups[1].Value }
    }
  } catch { }
  return $null
}

# ─────────── 读配置（必须 UTF-8 显式读，否则 PS5.1 会乱码） ───────────
function Read-Cfg($path) {
  try { return ([IO.File]::ReadAllText($path, [Text.Encoding]::UTF8) | ConvertFrom-Json) } catch { return $null }
}

Say ''
Say '  小汐 AI 直播平台 · 一键修复' ('White')
Say '  （只修确实有问题的项，健康系统不会被改动）' ('DarkGray')
if ($DryRun) { Say '  ⚠️ 试运行模式：只看不修' ('Yellow') }

$inst = Find-InstallDir
if (-not $inst) {
  Say ''
  Say '  ❌ 没找到安装目录。' ('Red')
  Say '     默认应该装在 D:\xiaoxi-ai-live' ('Red')
  Say '     如果你装在别处，先设置环境变量再运行：' ('Yellow')
  Say '       setx XIAOXI_HOME "你的安装目录"' ('Yellow')
  Say ''
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
  exit 1
}

Sec ('安装目录  ' + $inst)

# ─────────── 1. 版本 / 主程序 ───────────
$ver = ''
try { $ver = ([IO.File]::ReadAllText((Join-Path $inst 'VERSION'), [Text.Encoding]::UTF8)).Trim() } catch { }
$hasBundle = Test-Path (Join-Path $inst 'xiaoxi.mjs')
$hasSource = Test-Path (Join-Path $inst 'server.mjs')
Info ('版本 ' + $(if ($ver) { $ver } else { '(缺失)' }) + ' · 主程序 ' + $(if ($hasBundle) { 'xiaoxi.mjs' } else { 'server.mjs' }))
if (-not $hasBundle -and -not $hasSource) { Need '主程序缺失（xiaoxi.mjs / server.mjs 都没有）' '整包重新解压覆盖，保留 config.json' }

# ─────────── 2. Node.js ───────────
Sec 'Node.js'
$nodePath = $null
$cand = @(
  (Join-Path $inst 'runtime\node.exe'),
  'C:\Program Files\nodejs\node.exe',
  'C:\Program Files (x86)\nodejs\node.exe',
  (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'),
  $env:LIVE_AGENT_NODE
)
foreach ($c in $cand) {
  if ($c -and (Test-Path $c)) { $nodePath = $c; break }
}
if (-not $nodePath) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $nodePath = $cmd.Source }
}
if (-not $nodePath) {
  # 去 DSH 自带运行时里找
  $dshRt = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes'
  if (Test-Path $dshRt) {
    $hits = Get-ChildItem $dshRt -Recurse -Filter node.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\node\\' } | Sort-Object LastWriteTime -Descending
    if ($hits) { $nodePath = $hits[0].FullName }
  }
}

if ($nodePath) {
  $nv = & $nodePath -v 2>$null
  Info ('node ' + $nodePath + '  ' + $nv)
  $major = 0
  try { $major = [int](($nv -replace '^v', '') -split '\.')[0] } catch { }
  if ($major -lt 18) {
    Need ('Node 版本太低（' + $nv + '，要 18 以上）') '去 nodejs.org 装 LTS，装完重开'
  } else {
    if (-not $DryRun) {
      # 把找到的 node 写进环境变量，省得下次又找不到
      $cur = [Environment]::GetEnvironmentVariable('LIVE_AGENT_NODE', 'User')
      if ($cur -ne $nodePath) {
        [Environment]::SetEnvironmentVariable('LIVE_AGENT_NODE', $nodePath, 'User')
        Did ('已记住 node 位置 → 环境变量 LIVE_AGENT_NODE')
      } else { Info 'node 位置已记录过' }
    }
  }
} else {
  Need '找不到 Node.js（点启动没反应就是这个原因）' '装 https://nodejs.org 的 LTS，装完完全退出 DSH 再重开'
}

# ─────────── 3. 配置文件 ───────────
Sec '配置文件'
$cfgPath = Join-Path $inst 'config.json'
$cfg = $null
if (-not (Test-Path $cfgPath)) {
  Need 'config.json 不存在' '首次启动会自动生成；如果启动后仍没有，重装整包'
} else {
  $cfg = Read-Cfg $cfgPath
  if (-not $cfg) {
    # 损坏 → 备份后重建
    $bak = $cfgPath + '.broken-' + (Get-Date -Format 'MMdd-HHmm')
    if (-not $DryRun) {
      Copy-Item $cfgPath $bak -Force
      Remove-Item $cfgPath -Force
      Did ('config.json 损坏，已备份为 ' + (Split-Path $bak -Leaf) + '，重启后自动重建（人设/Key 需要重新填）')
    } else { Info 'config.json 损坏（试运行模式，未处理）' }
    $cfg = $null
  } else {
    Info 'config.json 正常'
    # 老版本没有 emotions 字段 → 下次启动会自动补，这里只提示
    if (-not ($cfg.PSObject.Properties.Name -contains 'emotions')) { Info '表情列表字段缺失（下次启动自动补默认值）' }
  }
}

if ($cfg) {
  # 回复开关
  if ($cfg.gate.enabled -eq $false) {
    if (-not $DryRun) {
      $raw = [IO.File]::ReadAllText($cfgPath, [Text.Encoding]::UTF8)
      $raw = [regex]::Replace($raw, '("gate"\s*:\s*\{[\s\S]*?"enabled"\s*:\s*)false', '${1}true', 1)
      [IO.File]::WriteAllText($cfgPath, $raw, (New-Object Text.UTF8Encoding($false)))
      $chk = Read-Cfg $cfgPath
      if ($chk -and $chk.gate.enabled -ne $false) { Did '「自动回复」原来是关的，已打开' }
      else { Need '想自动打开「自动回复」但没成功' '设置页手动打开' }
    } else { Need '「自动回复」是关闭的' '设置页打开，或让我帮你改' }
  }
  if (-not $cfg.llm.apiKey) { Need '模型 Key 没填（只会说兜底话术）' '设置页「AI 大脑」填 Key' }
  if (-not $cfg.douyin.webRid) { Need '抖音直播间号没填' '设置页填自己的直播间号' }
}

# ─────────── 4. 服务状态 ───────────
Sec '服务状态'
$port = if ($cfg -and $cfg.port) { [int]$cfg.port } else { 8792 }
Info ('端口 ' + $port)
$listen = Get-NetTCPConnection -LocalPort $port -State Listen
$procId = if ($listen) { ($listen | Select-Object -First 1).OwningProcess } else { 0 }
$healthOk = $false
try { $h = Invoke-RestMethod ("http://127.0.0.1:$port/health") -TimeoutSec 4; $healthOk = ($h.ok -eq $true) } catch { }

if ($procId -and $healthOk) {
  Info ('服务正常（PID ' + $procId + '，已运行 ' + [math]::Round($h.uptimeSec / 60) + ' 分钟）')
} elseif ($procId -and -not $healthOk) {
  # 进程在但不响应 → 重启
  if (-not $DryRun) {
    Info '进程在但不响应，正在重启…'
    Get-Process -Id $procId | Stop-Process -Force
    Start-Sleep -Seconds 2
    $start = Join-Path $inst '启动.vbs'
    if (Test-Path $start) { Start-Process $start } else { Start-Process (Join-Path $inst '启动.cmd') }
    Start-Sleep -Seconds 8
    try { $h2 = Invoke-RestMethod ("http://127.0.0.1:$port/health") -TimeoutSec 5; if ($h2.ok) { Did '服务已重启并恢复' } else { Need '重启后仍不响应' '看 supervisor.log 最后 20 行' } }
    catch { Need '重启后仍不响应' '看 supervisor.log 最后 20 行' }
  } else { Need '进程在但不响应（试运行，未重启）' '让我重启服务' }
} else {
  # 没在跑 → 起
  if (-not $DryRun) {
    Info '服务没在跑，正在启动…'
    $start = Join-Path $inst '启动.vbs'
    if (Test-Path $start) { Start-Process $start } else { Start-Process (Join-Path $inst '启动.cmd') }
    Start-Sleep -Seconds 10
    try { $h2 = Invoke-RestMethod ("http://127.0.0.1:$port/health") -TimeoutSec 5; if ($h2.ok) { Did '服务已启动' } else { Need '服务起来了但 health 不通' '看 supervisor.log' } }
    catch { Need '服务没起来' '多半是 Node.js 缺失或配置损坏' }
  } else { Need '服务没在运行（试运行，未启动）' '让我启动服务' }
}

# ─────────── 5. 网络 ───────────
Sec '网络'
foreach ($it in @(
  @('更新源', 'https://raw.githubusercontent.com/Oldattack/xiaoxi-ai-live/main/updates/beta/manifest.json'),
  @('抖音', 'https://www.douyin.com')
)) {
  $okNet = $false
  try { $r = Invoke-WebRequest $it[1] -UseBasicParsing -Method Head -TimeoutSec 8; $okNet = ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) }
  catch { try { $c = [int]$_.Exception.Response.StatusCode; $okNet = ($c -ge 200 -and $c -lt 500) } catch { } }
  if ($okNet) { Info ($it[0] + ' 可访问') } else { Need ($it[0] + ' 连不上') '换网络（手机热点）再试；只影响更新/采集，不影响已连上的直播' }
}

# ─────────── 6. 磁盘 ───────────
Sec '磁盘'
try {
  $q = (Split-Path $inst -Qualifier).TrimEnd(':')
  $d = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Name -eq $q }
  if ($d) {
    $freeGB = [math]::Round($d.Free / 1GB, 1)
    if ($freeGB -lt 2) { Need ('磁盘只剩 ' + $freeGB + ' GB') '清理空间，否则更新会失败' }
    else { Info ('剩余 ' + $freeGB + ' GB') }
  }
} catch { }

# ─────────── 7. 结果 ───────────
Sec '结果'
if ($Fixed.Count -eq 0 -and $Manual.Count -eq 0) {
  Say '  🎉 各项都正常，没发现需要修的地方。' ('Green')
} else {
  if ($Fixed.Count) {
    Say ('  已自动修复 ' + $Fixed.Count + ' 项：') ('Green')
    foreach ($f in $Fixed) { Say ('    ✅ ' + $f) ('Green') }
  }
  if ($Manual.Count) {
    Say ''
    Say ('  还需要处理 ' + $Manual.Count + ' 项：') ('Yellow')
    foreach ($m in $Manual) { Say ('    ⚠️  ' + $m) ('Yellow') }
  }
}

# 需要人工的都整理成一段话，复制到剪贴板
if ($Manual.Count) {
  $text = @()
  $text += '【小汐AI直播平台 · 修复结果】'
  $text += ('安装目录：' + $inst)
  $text += ('版本：' + $(if ($ver) { $ver } else { '未知' }))
  $text += ('node：' + $(if ($nodePath) { $nodePath + ' ' + $nv } else { '没找到' }))
  $text += ''
  $text += ('已自动修复：' + $(if ($Fixed.Count) { $Fixed -join '；' } else { '无' }))
  $text += ''
  $text += '还需要处理：'
  foreach ($m in $Manual) { $text += ('- ' + $m) }
  $text += ''
  $text += '请按上面的提示给我具体操作步骤。'
  $text = $text -join "`r`n"
  try {
    Set-Clipboard -Value $text
    Say ''
    Say '  📋 上面这些已经复制到剪贴板了 —— 直接 Ctrl+V 粘到 AI 对话框即可。' ('Cyan')
  } catch { }
  try {
    $out = Join-Path $inst ('修复结果-' + (Get-Date -Format 'MMdd-HHmm') + '.txt')
    $text | Set-Content -Path $out -Encoding UTF8
    Say ('  📄 也存了一份：' + $out) ('Cyan')
  } catch { }
}

Say ''
if (-not $NoPause) {
  Say '  按任意键关闭…' ('DarkGray')
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
}
exit 0
