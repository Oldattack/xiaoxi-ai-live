# 小汐AI直播平台 · 装 DSH 插件
# 关键点：写 package.json 必须用 UTF-8 无 BOM，否则 DSH 启动会崩（JSON.parse 不认识 BOM）
param(
  [string]$DshHome = "$env:USERPROFILE\.dsh",
  [string]$PluginDir = ''
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($PluginDir) { $pluginSrc = $PluginDir }
elseif (Test-Path (Join-Path $here 'plugin')) { $pluginSrc = Join-Path $here 'plugin' }
else { $pluginSrc = Join-Path $here '..\live-agent-plugin' }

if (-not (Test-Path $pluginSrc)) { Write-Host "[X] 找不到 plugin 目录：$pluginSrc"; exit 1 }
if (-not (Test-Path $DshHome)) {
  Write-Host "[X] 没找到 DSH：$DshHome"
  Write-Host "    先装 DeepSeek Harness，或者用「启动.cmd」直接开网页版。"
  exit 1
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# 读 JSON：自动去掉 BOM
function Read-JsonFile([string]$path) {
  $raw = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  $raw = $raw.TrimStart([char]0xFEFF)
  return ($raw | ConvertFrom-Json)
}

# 写 JSON：UTF-8 无 BOM + 写前校验
function Write-JsonFile([string]$path, $obj) {
  $json = $obj | ConvertTo-Json -Depth 12
  # 自己先验一遍，能 parse 才落盘
  try { $null = $json | ConvertFrom-Json } catch { throw "生成的 JSON 不合法，已中止：$($_.Exception.Message)" }
  [IO.File]::WriteAllText($path, $json, $utf8NoBom)
}

# 读插件名
$pkg = Read-JsonFile (Join-Path $pluginSrc 'package.json')
$name = $pkg.name
$short = ($name -split '/')[-1]
Write-Host "[..] 插件：$name"

# 1) 复制到 ~/.dsh/plugins/<short>
$pluginsRoot = Join-Path $DshHome 'plugins'
New-Item -ItemType Directory -Force -Path $pluginsRoot | Out-Null
$target = Join-Path $pluginsRoot $short
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Copy-Item $pluginSrc $target -Recurse

# 2) 主程序目录（绝对路径）
[IO.File]::WriteAllText((Join-Path $target 'agent-path.txt'), $here, $utf8NoBom)
Write-Host "[OK] 主程序目录：$here"

# 3) 注册到 desktop profile
$profileDir = Join-Path $DshHome 'profiles\desktop'
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
$pj = Join-Path $profileDir 'package.json'
if (-not (Test-Path $pj)) {
  Write-Host "[X] profile 里没有 package.json：$pj"
  Write-Host "    先在 DSH 里打开一次（让它初始化），再运行本脚本。"
  exit 1
}
Copy-Item $pj "$pj.bak-xiaoxi" -Force

try {
  $cfg = Read-JsonFile $pj
} catch {
  # 原文件已经坏了（比如上次写了 BOM）：从备份恢复
  Write-Host "[!] 现有 package.json 解析失败，尝试从备份恢复…"
  $bak = Get-ChildItem (Split-Path $pj) -Filter 'package.json*' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne 'package.json' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($bak) {
    Copy-Item $bak.FullName $pj -Force
    $cfg = Read-JsonFile $pj
    Write-Host "[OK] 已从 $($bak.Name) 恢复"
  } else {
    Write-Host "[X] 没有可用的备份，请先用「修复DSH.cmd」或手动修好 package.json"
    exit 1
  }
}

if (-not $cfg.PSObject.Properties['dependencies']) {
  $cfg | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{})
}
$link = 'link:' + ($target -replace '\\', '/')
if ($cfg.dependencies.PSObject.Properties[$name]) {
  $cfg.dependencies.$name = $link
} else {
  $cfg.dependencies | Add-Member -NotePropertyName $name -NotePropertyValue $link
}

if (-not $cfg.PSObject.Properties['dsh']) { $cfg | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) }
if (-not $cfg.dsh.PSObject.Properties['profile']) { $cfg.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) }
$bundles = @($cfg.dsh.profile.bundles)
if ($bundles -notcontains $name) { $bundles += $name }
$cfg.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue $bundles -Force

try {
  Write-JsonFile $pj $cfg
  Write-Host "[OK] 已写入 profile/package.json（UTF-8 无 BOM）"
} catch {
  Copy-Item "$pj.bak-xiaoxi" $pj -Force
  Write-Host "[X] 写入失败，已回滚：$($_.Exception.Message)"
  exit 1
}

# 4) 校验：让 node 真的 parse 一遍
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $check = & node -e "try{JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('OK')}catch(e){console.log('BAD')}" $pj 2>$null
  if ("$check".Trim() -ne 'OK') {
    Copy-Item "$pj.bak-xiaoxi" $pj -Force
    Write-Host "[X] 校验没通过（JSON 仍然不合法），已回滚"
    exit 1
  }
  Write-Host "[OK] JSON 校验通过"
}

# 5) node_modules/@local 链接
$localDir = Join-Path $profileDir 'node_modules\@local'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
$linkPath = Join-Path $localDir $short
if (Test-Path $linkPath) { Remove-Item $linkPath -Recurse -Force -ErrorAction SilentlyContinue }
try {
  New-Item -ItemType Junction -Path $linkPath -Target $target | Out-Null
  Write-Host "[OK] 已建立链接：node_modules\@local\$short"
} catch {
  Copy-Item $target $linkPath -Recurse
  Write-Host "[OK] 已复制到 node_modules\@local\$short"
}

Write-Host ''
Write-Host '=========================================='
Write-Host ' 装好了。接下来：'
Write-Host '   1. 完全退出 DSH（托盘也退出）'
Write-Host '   2. 重新打开 DSH'
Write-Host '   3. 左侧栏会出现「小汐AI直播平台」'
Write-Host ''
Write-Host ' 如果 DSH 打不开了：双击「修复DSH.cmd」'
Write-Host '=========================================='
exit 0
