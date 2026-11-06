# 把「小汐AI直播平台」装成 DSH 插件（侧栏出现入口）
param(
  [string]$DshHome = "$env:USERPROFILE\.dsh"
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginSrc = Join-Path $here 'plugin'
if (-not (Test-Path $pluginSrc)) { Write-Host "[X] 找不到 plugin 目录：$pluginSrc"; exit 1 }
if (-not (Test-Path $DshHome)) {
  Write-Host "[X] 没找到 DSH：$DshHome"
  Write-Host "    先装 DeepSeek Harness，或者用「启动.cmd」直接开网页版。"
  exit 1
}

# 读插件名
$pkg = Get-Content (Join-Path $pluginSrc 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$name = $pkg.name
$short = ($name -split '/')[-1]
Write-Host "[..] 插件：$name"

# 1) 复制到 ~/.dsh/plugins/<short>
$pluginsRoot = Join-Path $DshHome 'plugins'
New-Item -ItemType Directory -Force -Path $pluginsRoot | Out-Null
$target = Join-Path $pluginsRoot $short
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Copy-Item $pluginSrc $target -Recurse

# 2) 告诉插件：主程序在哪（绝对路径，别用相对路径）
Set-Content -Path (Join-Path $target 'agent-path.txt') -Value $here -Encoding UTF8
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

$cfg = Get-Content $pj -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $cfg.PSObject.Properties['dependencies']) {
  $cfg | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{})
}
$link = 'link:' + ($target -replace '\\', '/')
if ($cfg.dependencies.PSObject.Properties[$name]) {
  $cfg.dependencies.$name = $link
} else {
  $cfg.dependencies | Add-Member -NotePropertyName $name -NotePropertyValue $link
}

if (-not $cfg.dsh) { $cfg | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) }
if (-not $cfg.dsh.profile) { $cfg.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) }
$bundles = @($cfg.dsh.profile.bundles)
if ($bundles -notcontains $name) { $bundles += $name }
$cfg.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue $bundles -Force

$cfg | ConvertTo-Json -Depth 10 | Set-Content $pj -Encoding UTF8
Write-Host "[OK] 已写入 profile/package.json"

# 4) 在 node_modules/@local 里做链接（DSH 从这里找包）
$localDir = Join-Path $profileDir 'node_modules\@local'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
$linkPath = Join-Path $localDir $short
if (Test-Path $linkPath) { Remove-Item $linkPath -Recurse -Force -ErrorAction SilentlyContinue }
try {
  New-Item -ItemType Junction -Path $linkPath -Target $target | Out-Null
  Write-Host "[OK] 已建立链接：node_modules\@local\$short"
} catch {
  # 退路：复制一份（不影响使用）
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
Write-Host ' 如果没出现：'
Write-Host '   - 在 DSH 里打开 设置 → 插件，看有没有 @local/dsh-live-agent'
Write-Host '   - 把本窗口截图发我'
Write-Host '=========================================='
