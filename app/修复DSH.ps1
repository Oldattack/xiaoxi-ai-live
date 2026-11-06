# 小汐AI直播平台 · 修复 DSH（当 DSH 打不开 / 加载失败时用）
# 作用：从 DSH 的 profile 里摘掉小汐插件，让 DSH 恢复正常启动

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
Add-Type -AssemblyName System.Windows.Forms | Out-Null

$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$autoYes = ($env:XIAOXI_AUTOYES -eq '1')
$PLUGIN = '@local/dsh-live-agent'

function Info($m) { Write-Host "  $m" }
function Say($m) {
  if ($autoYes) { Info $m; return }
  [System.Windows.Forms.MessageBox]::Show($m, '小汐 · 修复 DSH', 'OK', 'Information') | Out-Null
}

Write-Host ''
Write-Host '  小汐AI直播平台 · 修复 DSH' -ForegroundColor Cyan
Write-Host '  ------------------------------------' -ForegroundColor DarkGray

$profilesDir = Join-Path $dshHome 'profiles'
if (-not (Test-Path $profilesDir)) {
  Say "没找到 DSH 配置目录：`n$profilesDir`n`n这台机器可能没装 DSH。"
  exit 1
}

$fixed = 0
foreach ($prof in (Get-ChildItem $profilesDir -Directory)) {
  $pkg = Join-Path $prof.FullName 'package.json'
  if (-not (Test-Path $pkg)) { continue }
  Info "处理 profile: $($prof.Name)"

  # 1) 先备份
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $bak = "$pkg.beforefix-$stamp"
  Copy-Item $pkg $bak -Force -ErrorAction SilentlyContinue
  Info "  已备份: $(Split-Path $bak -Leaf)"

  # 2) 解析；解析不了就用最近的 package.json.bak-* 还原
  $json = $null
  try { $json = Get-Content -Raw -Encoding UTF8 $pkg | ConvertFrom-Json } catch { $json = $null }

  if (-not $json) {
    Info '  package.json 已损坏，尝试用历史备份还原…' 
    $old = Get-ChildItem $prof.FullName -Filter 'package.json.bak-*' -ErrorAction SilentlyContinue |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($old) {
      Copy-Item $old.FullName $pkg -Force
      Info "  已还原: $($old.Name)"
      try { $json = Get-Content -Raw -Encoding UTF8 $pkg | ConvertFrom-Json } catch { $json = $null }
    }
  }

  if (-not $json) {
    Info '  [!!] 仍然无法修复，请手动删除：' -ForegroundColor Red
    Info "       $pkg"
    continue
  }

  # 3) 摘掉小汐插件
  $changed = $false
  if ($json.dsh -and $json.dsh.profile -and $json.dsh.profile.bundles) {
    $before = @($json.dsh.profile.bundles).Count
    $json.dsh.profile.bundles = @($json.dsh.profile.bundles | Where-Object { $_ -ne $PLUGIN })
    if (@($json.dsh.profile.bundles).Count -ne $before) { $changed = $true }
  }
  if ($json.dependencies) {
    $props = $json.dependencies.PSObject.Properties.Name
    if ($props -contains $PLUGIN) {
      $json.dependencies.PSObject.Properties.Remove($PLUGIN)
      $changed = $true
    }
  }

  if ($changed) {
    $out = $json | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($pkg, $out, [Text.UTF8Encoding]::new($false))
    Info '  已移除小汐插件的登记' -ForegroundColor Green
    $fixed++
  } else {
    Info '  没有发现小汐插件的登记（可能已经清过）'
  }

  # 4) 删掉插件目录
  $dest = Join-Path $prof.FullName 'node_modules\@local\dsh-live-agent'
  if (Test-Path $dest) {
    $item = Get-Item $dest -Force
    if ($item.LinkType) { cmd /c "rmdir `"$dest`"" 2>$null | Out-Null }
    else { Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue }
    Info '  已删除插件文件'
  }
}

Write-Host ''
if ($fixed -gt 0) {
  Say "修复完成，共处理 $fixed 个 profile。`n`n现在完全退出 DSH，再重新打开，应该就能正常加载了。"
} else {
  Say "配置里没找到小汐插件，DSH 打不开可能是别的原因。`n`n可以试试：`n1. 完全退出 DSH（任务管理器里结束所有 dsh 进程）`n2. 重新打开"
}
