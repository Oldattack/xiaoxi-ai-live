# 启动时检查 DSH：装了就把插件登记好，没装就提示用网页版
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dsh = Join-Path $env:USERPROFILE '.dsh'
$profileDir = Join-Path $dsh 'profiles\desktop'
$pkgFile = Join-Path $profileDir 'package.json'
$pluginName = '@local/dsh-live-agent'

if (-not (Test-Path $dsh)) {
  Write-Host '  [--] 没装 DSH：用网页版就行'
  Write-Host '       想用侧栏插件，先装 DeepSeek Harness，再双击「安装到DSH.cmd」'
  exit 0
}

if (-not (Test-Path $pkgFile)) {
  Write-Host '  [--] 检测到 DSH，但 profile 还没初始化'
  Write-Host '       先打开一次 DSH，再双击「安装到DSH.cmd」'
  exit 0
}

# 已经登记过？
$registered = $false
try {
  $raw = Get-Content $pkgFile -Raw -Encoding UTF8
  if ($raw -match [regex]::Escape($pluginName)) { $registered = $true }
} catch {}

if ($registered) {
  Write-Host '  [OK] DSH 插件已安装'
  exit 0
}

# 没登记 → 自动装一次
Write-Host '  [..] 发现 DSH，正在安装插件…'
$installer = Join-Path $here 'install-plugin.ps1'
if (-not (Test-Path $installer)) {
  Write-Host '  [!] 找不到 install-plugin.ps1，跳过'
  exit 0
}

# 插件目录：正式包是 .\plugin，开发目录是 ..\live-agent-plugin
$pluginDir = Join-Path $here 'plugin'
if (-not (Test-Path $pluginDir)) { $pluginDir = Join-Path $here '..\live-agent-plugin' }

$code = 1
try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $installer -PluginDir $pluginDir 2>&1 | ForEach-Object {
    $line = "$_".Trim()
    if ($line) { Write-Host ('       ' + $line) }
  }
  $code = $LASTEXITCODE
} catch {
  $code = 1
}

if ($code -eq 0) {
  Write-Host '  [OK] 插件已登记：重启一次 DSH，左侧栏就会出现'
} else {
  Write-Host '  [!] 自动安装没成功，可以手动双击「安装到DSH.cmd」'
}
