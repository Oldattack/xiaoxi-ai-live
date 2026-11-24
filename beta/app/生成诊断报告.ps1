# 小汐 AI 直播平台 · 现场自检（把生成的报告发给 AI）
#
# 用法：右键「使用 PowerShell 运行」，或在终端执行：
#   powershell -ExecutionPolicy Bypass -File 自检.ps1
#
# 目的：把这个脚本采集到的信息整段复制给 AI，AI 就能按《发给AI.md》里的问题库
#      对症给出修复步骤，不用来回问「你版本多少」「日志有什么」。
#
# 安全：不读取、不输出任何密钥；config.json 里的 apiKey/token 一律打码。
# 兼容：PowerShell 5.1（Windows 自带），不依赖任何模块。

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

function Line($t) { Write-Host $t }
function Sec($t) { Write-Host ''; Write-Host ('=' * 60); Write-Host ('  ' + $t); Write-Host ('=' * 60) }

$lines = New-Object System.Collections.ArrayList
function Add($t) { [void]$lines.Add([string]$t); Write-Host $t }

# ── 找安装目录：脚本所在目录 → 常见位置 → 进程命令行 ──
function Find-InstallDir {
  $cands = @()
  $here = Split-Path -Parent $MyInvocation.MyCommand.Path
  if ($here) {
    $cands += (Split-Path -Parent $here)      # 客服助手/ 的上一层
    $cands += $here
  }
  $cands += @('D:\xiaoxi-ai-live', 'C:\xiaoxi-ai-live', 'E:\xiaoxi-ai-live')
  foreach ($c in $cands) {
    if ($c -and (Test-Path (Join-Path $c 'xiaoxi.mjs'))) { return $c }
    if ($c -and (Test-Path (Join-Path $c 'server.mjs'))) { return $c }
  }
  # 从进程里反查
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

# ── 1. 基本信息 ──
Sec '1. 基本信息'
Add ('时间      : ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Add ('电脑名    : ' + $env:COMPUTERNAME)
Add ('系统      : ' + [System.Environment]::OSVersion.VersionString)
Add ('PowerShell: ' + $PSVersionTable.PSVersion)

$inst = Find-InstallDir
Add ('安装目录  : ' + $(if ($inst) { $inst } else { '（没找到，可能没装或装在别处）' }))

if ($inst) {
  $verFile = Join-Path $inst 'VERSION'
  if (Test-Path $verFile) { Add ('版本号    : ' + ((Get-Content $verFile -Raw).Trim())) }
  else { Add '版本号    : （VERSION 文件缺失！）' }
  if (Test-Path (Join-Path $inst 'xiaoxi.mjs')) { Add '主程序    : xiaoxi.mjs（混淆版）' }
  elseif (Test-Path (Join-Path $inst 'server.mjs')) { Add '主程序    : server.mjs（源码版）' }
  else { Add '主程序    : 缺失！' }
}

# ── 2. Node.js ──
Sec '2. Node.js'
$nodeCmd = $null
foreach ($n in @('node', (Join-Path $inst 'runtime\node.exe'), 'C:\Program Files\nodejs\node.exe')) {
  try {
    $v = & $n -v 2>$null
    if ($v) { $nodeCmd = $n; Add ('node      : ' + $n); Add ('版本      : ' + $v); break }
  } catch { }
}
if (-not $nodeCmd) { Add 'node      : ❌ 找不到！这是「点启动没反应」最常见的原因' }
if ($env:LIVE_AGENT_NODE) { Add ('环境变量 LIVE_AGENT_NODE = ' + $env:LIVE_AGENT_NODE) }

# ── 3. 服务状态 ──
Sec '3. 服务状态'
$port = 8792
$cfgPath = if ($inst) { Join-Path $inst 'config.json' } else { $null }
if ($cfgPath -and (Test-Path $cfgPath)) {
  try {
    $raw = [IO.File]::ReadAllText($cfgPath, [Text.Encoding]::UTF8)
    $m = [regex]::Match($raw, '"port"\s*:\s*(\d+)')
    if ($m.Success) { $port = [int]$m.Groups[1].Value }
  } catch { }
}
Add ('端口      : ' + $port)
$listen = Get-NetTCPConnection -LocalPort $port -State Listen
if ($listen) {
  $pid0 = ($listen | Select-Object -First 1).OwningProcess
  $proc = Get-Process -Id $pid0
  Add ('监听      : ✅ 有进程（PID ' + $pid0 + '，' + $proc.ProcessName + '，内存 ' + [math]::Round($proc.WorkingSet64/1MB) + ' MB）')
  $started = (Get-CimInstance Win32_Process -Filter "ProcessId=$pid0").CreationDate
  if ($started) { Add ('启动时间  : ' + $started) }
} else {
  Add '监听      : ❌ 没有进程在监听（服务没起来）'
}
try {
  $h = Invoke-RestMethod ("http://127.0.0.1:$port/health") -TimeoutSec 5
  Add ('/health   : ok=' + $h.ok + ' 运行 ' + [math]::Round($h.uptimeSec/60) + ' 分钟  收到 ' + $h.received + ' 条  回了 ' + $h.replied + ' 条  丢弃 ' + $h.dropped)
} catch {
  Add ('/health   : ❌ 打不开（' + $_.Exception.Message + '）')
}

# ── 4. 配置（密钥打码）──
Sec '4. 配置概览（不含密钥）'
if ($cfgPath -and (Test-Path $cfgPath)) {
  try {
    $cfg = [IO.File]::ReadAllText($cfgPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    Add ('模型      : ' + $(if ($cfg.llm.enabled) { '已开' } else { '关闭' }) + ' / ' + $cfg.llm.baseUrl + ' / ' + $cfg.llm.model)
    Add ('Key       : ' + $(if ($cfg.llm.apiKey) { '已填（' + $cfg.llm.apiKey.Length + ' 位，尾号 ' + $cfg.llm.apiKey.Substring([Math]::Max(0,$cfg.llm.apiKey.Length-4)) + '）' } else { '❌ 空' }))
    Add ('快速模式  : ' + $cfg.llm.fastMode + '  字数上限 ' + $cfg.llm.maxChars + '  温度 ' + $cfg.llm.temperature)
    Add ('语音      : ' + $(if ($cfg.tts.enabled) { '已开' } else { '关闭' }) + ' / ' + $cfg.tts.provider + ' / ' + $cfg.tts.voice)
    Add ('语音Key   : ' + $(if ($cfg.tts.apiKey -or $cfg.tts.token) { '已填' } else { '空' }))
    Add ('回复开关  : ' + $(if ($cfg.gate.enabled -eq $false) { '❌ 关闭（不会自动回弹幕）' } else { '开' }))
    Add ('抖音房间号: ' + $(if ($cfg.douyin.webRid) { $cfg.douyin.webRid } else { '❌ 空' }) + '  自动连=' + $cfg.douyin.autoConnect)
    Add ('人物形象  : ' + $cfg.avatar.kind + ' / ' + $cfg.avatar.model)
    Add ('表情素材  : ' + ((($cfg.avatar.sources | Get-Member -MemberType NoteProperty) | ForEach-Object { $_.Name }) -join ', '))
    Add ('更新通道  : ' + $cfg.update.channel + ' 自动检查=' + $cfg.update.checkOnStart)
  } catch {
    Add ('config.json 解析失败：' + $_.Exception.Message + '（可能文件损坏）')
  }
} else {
  Add 'config.json: ❌ 不存在'
}

# ── 5. 进程与残留 ──
Sec '5. 相关进程'
$nodes = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'xiaoxi|server\.mjs|supervisor' }
if ($nodes) {
  foreach ($n in $nodes) { Add ('node PID ' + $n.ProcessId + ' : ' + ($n.CommandLine -replace '\s+', ' ').Substring(0, [Math]::Min(110, $n.CommandLine.Length))) }
} else { Add 'node      : 没有小汐相关进程' }
$chrome = Get-Process chrome -ErrorAction SilentlyContinue | Measure-Object
Add ('Chrome 进程数: ' + $chrome.Count + '（抖音采集会额外开几个，属正常）')
$obs = Get-Process obs64, obs32, obs -ErrorAction SilentlyContinue
Add ('OBS       : ' + $(if ($obs) { '运行中' } else { '没开' }))

# ── 6. 日志尾部 ──
Sec '6. 日志尾部（最近 25 行）'
$log = if ($inst) { Join-Path $inst 'supervisor.log' } else { $null }
if ($log -and (Test-Path $log)) {
  $fs = $null
  try {
    $fs = [System.IO.File]::Open($log, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $sr = New-Object System.IO.StreamReader($fs, [Text.Encoding]::UTF8)
    $all = $sr.ReadToEnd()
    $sr.Close()
    $tail = ($all -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 25)
  } finally {
    if ($fs) { $fs.Close() }
  }
  foreach ($t in $tail) { Add ('  | ' + $t) }
  $size = (Get-Item $log).Length
  Add ('（日志大小 ' + [math]::Round($size/1KB) + ' KB）')
} else {
  Add 'supervisor.log: 不存在'
}

# ── 7. 网络 ──
Sec '7. 网络连通性'
foreach ($u in @(
  @('更新源 raw.githubusercontent.com', 'https://raw.githubusercontent.com/Oldattack/xiaoxi-ai-live/main/updates/beta/manifest.json'),
  @('模型接口 api.deepseek.com', 'https://api.deepseek.com'),
  @('抖音 www.douyin.com', 'https://www.douyin.com')
)) {
  try {
    $r = Invoke-WebRequest $u[1] -UseBasicParsing -TimeoutSec 8 -Method Head
    Add ($u[0] + ' : ✅ HTTP ' + $r.StatusCode)
  } catch {
    $code = 0
    try { $code = [int]$_.Exception.Response.StatusCode } catch { }
    if ($code -ge 200 -and $code -lt 500) { Add ($u[0] + ' : ✅ 可访问（HTTP ' + $code + '，没带密钥所以不是 200）') }
    else { Add ($u[0] + ' : ❌ ' + $_.Exception.Message) }
  }
}

# ── 8. 磁盘与防火墙 ──
Sec '8. 其他'
if ($inst) {
  try {
    $d = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Name -eq (Split-Path $inst -Qualifier).TrimEnd(':') }
    if ($d) { Add ('剩余空间  : ' + [math]::Round($d.Free/1GB, 1) + ' GB') }
  } catch { }
  $coreOk = (Test-Path (Join-Path $inst 'xiaoxi.mjs')) -or (Test-Path (Join-Path $inst 'server.mjs'))
  $items = @()
  $items += $(if ($coreOk) { '主程序✓' } else { '❌主程序缺失' })
  foreach ($f in @('scene.html','settings.html','sprites_hd','supervisor.mjs')) {
    if (Test-Path (Join-Path $inst $f)) { $items += ($f + '✓') } else { $items += ('❌' + $f) }
  }
  Add ('关键文件  : ' + ($items -join ' '))
}
try {
  $fw = Get-NetFirewallRule -DisplayName '*xiaoxi*','*小汐*' -ErrorAction SilentlyContinue
  Add ('防火墙规则: ' + $(if ($fw) { ($fw | Measure-Object).Count.ToString() + ' 条' } else { '无（本机用不影响）' }))
} catch { }

# ── 写文件 ──
$outDir = if ($inst) { $inst } else { (Split-Path -Parent $MyInvocation.MyCommand.Path) }
$outFile = Join-Path $outDir ('诊断报告-' + (Get-Date -Format 'MMdd-HHmm') + '.txt')
try {
  $head = @(
    '【小汐AI直播平台 现场诊断报告】',
    '把下面全部内容（从这里到最后一行）复制给 AI，它就知道该怎么修了。',
    ''
  )
  ($head + $lines) -join "`r`n" | Set-Content -Path $outFile -Encoding UTF8
  Write-Host ''
  Write-Host ('报告已保存：' + $outFile) -ForegroundColor Green
  Write-Host '把这个文件（或文件内容）直接拖进 AI 对话框即可。' -ForegroundColor Green
  try { Start-Process notepad.exe $outFile } catch { }
} catch {
  Write-Host ('保存失败：' + $_.Exception.Message) -ForegroundColor Red
  Write-Host '可以直接复制上面屏幕里的内容。'
}
Write-Host ''
Write-Host '按任意键关闭…'
try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { }
exit 0
