# 把本包的 plugin/ 装进 DSH（自动找 profile，自动改配置）
# 用法：双击 安装到DSH.cmd，或 powershell -File install-plugin.ps1

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginSrc = Join-Path $root 'plugin'
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }

Write-Host ''
Write-Host '  小汐AI直播平台 · 装进 DSH 侧栏' -ForegroundColor Cyan
Write-Host '  ------------------------------------' -ForegroundColor DarkGray

if (-not (Test-Path $pluginSrc)) {
  Write-Host '  [!!] 找不到本目录下的 plugin\ 文件夹' -ForegroundColor Red
  Write-Host '  请确认 安装到DSH.cmd 和 plugin\ 在同一个文件夹里。'
  Read-Host '  按回车退出'
  exit 1
}

$profilesDir = Join-Path $dshHome 'profiles'
if (-not (Test-Path $profilesDir)) {
  Write-Host "  [!!] 没找到 DSH 配置目录：$profilesDir" -ForegroundColor Red
  Write-Host '  说明这台机器没装过 DeepSeek Harness，或者装在了别的用户下。'
  Write-Host '  没有 DSH 也能用：直接双击 打开直播设置.cmd 即可。'
  Read-Host '  按回车退出'
  exit 1
}

$profiles = Get-ChildItem $profilesDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'package.json') }
if (-not $profiles) {
  Write-Host '  [!!] DSH 里还没有任何 profile' -ForegroundColor Red
  Read-Host '  按回车退出'
  exit 1
}

$done = 0
foreach ($prof in $profiles) {
  $pkgPath = Join-Path $prof.FullName 'package.json'
  try {
    $json = Get-Content -Raw -Encoding UTF8 $pkgPath | ConvertFrom-Json
  } catch {
    Write-Host "  [..] 跳过 $($prof.Name)：package.json 读不了"
    continue
  }
  if (-not $json.dsh -or -not $json.dsh.profile) {
    Write-Host "  [..] 跳过 $($prof.Name)：不是 DSH profile"
    continue
  }

  Write-Host "  [..] 处理 profile: $($prof.Name)"

  # 1) 复制插件文件
  $dest = Join-Path $prof.FullName 'node_modules\@local\dsh-live-agent'
  if (Test-Path $dest) {
    $item = Get-Item $dest -Force
    if ($item.LinkType) { cmd /c "rmdir `"$dest`"" 2>$null }   # 旧 junction/symlink
    else { Remove-Item $dest -Recurse -Force }
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
  Copy-Item -Path $pluginSrc -Destination $dest -Recurse -Force
  # 插件被复制到 node_modules 里，相对路径会失效，写成安装目录的绝对路径
  Set-Content -Path (Join-Path $dest 'agent-path.txt') -Value $root -Encoding UTF8 -NoNewline

  # 2) package.json：dependencies + bundles
  if (-not $json.dependencies) {
    $json | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) -Force
  }
  $json.dependencies | Add-Member -NotePropertyName '@local/dsh-live-agent' `
    -NotePropertyValue ("link:" + ($pluginSrc -replace '\\', '/')) -Force

  $bundles = @($json.dsh.profile.bundles)
  if ($bundles -notcontains '@local/dsh-live-agent') { $bundles += '@local/dsh-live-agent' }
  $json.dsh.profile.bundles = $bundles

  $out = $json | ConvertTo-Json -Depth 12
  [IO.File]::WriteAllText($pkgPath, $out, [Text.UTF8Encoding]::new($false))
  $done++
  Write-Host "  [OK] 已写入 $($prof.Name)" -ForegroundColor Green
}

if ($done -eq 0) {
  Write-Host '  [!!] 没有可以安装的 profile' -ForegroundColor Red
  Read-Host '  按回车退出'
  exit 1
}

Write-Host ''
Write-Host '  装好了！' -ForegroundColor Cyan
Write-Host '  现在请：完全退出 DSH（不是最小化），重新打开。'
Write-Host '  左侧栏就会出现「小汐 AI 直播平台」，点进去就是设置页。'
Write-Host ''
Read-Host '  按回车退出'
