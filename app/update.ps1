# 小汐AI直播平台 · 一键更新（不依赖程序内的更新器）
# 双击 一键更新.cmd 运行；本文件必须和 启动.cmd / VERSION 在同一个目录

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$mirrors = @(
  'https://raw.githubusercontent.com/Oldattack/xiaoxi-ai-live/main/updates/manifest.json',
  'https://cdn.jsdelivr.net/gh/Oldattack/xiaoxi-ai-live@main/updates/manifest.json'
)

function Ver([string]$v) {
  $p = ($v -split '[.\-+]') | ForEach-Object { [int]($_ -replace '\D', '') }
  while ($p.Count -lt 3) { $p += 0 }
  return ($p[0..2] -join '.')
}

Write-Host ''
Write-Host '  小汐AI直播平台 · 一键更新' -ForegroundColor Cyan
Write-Host '  ------------------------------------' -ForegroundColor DarkGray

$verFile = Join-Path $root 'VERSION'
$local = if (Test-Path $verFile) { (Get-Content $verFile -Raw).Trim() } else { '0.0.0' }
Write-Host "  当前版本  $local"

# 1) 逐个镜像取清单，取“版本最高”的那个（避免 CDN 缓存旧版本）
$manifest = $null
$base = $null
foreach ($u in $mirrors) {
  try {
    Write-Host "  [..] 尝试 $u"
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 20 -Headers @{ 'cache-control' = 'no-cache' }
    $m = $r.Content | ConvertFrom-Json
    if ($m.version -and $m.package) {
      Write-Host "      返回版本 $($m.version)"
      if (-not $manifest -or ((Ver $m.version) -gt (Ver $manifest.version))) {
        $manifest = $m
        $base = $u.Substring(0, $u.LastIndexOf('/') + 1)
      }
    }
  } catch {
    Write-Host "  [!!] 失败：$($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}
if ($manifest) {
  Write-Host "  [OK] 采用版本 $($manifest.version)" -ForegroundColor Green
}

if (-not $manifest) {
  Write-Host ''
  Write-Host '  两个地址都连不上，可能是网络问题。' -ForegroundColor Red
  Write-Host '  可以换个网络（比如手机热点）再试一次。'
  Read-Host '  按回车退出'
  exit 1
}

if ((Ver $manifest.version) -le (Ver $local)) {
  Write-Host "  已经是最新版（$local），不用更新。" -ForegroundColor Green
  Read-Host '  按回车退出'
  exit 0
}

# 2) 下载
$pkgUrl = $base + $manifest.package
$tmp = Join-Path $env:TEMP ("xiaoxi-upd-" + $manifest.version + ".zip")
Write-Host ''
Write-Host "  开始下载 $($manifest.package)（约 $([math]::Round($manifest.size/1MB,1)) MB）"
Write-Host "  地址 $pkgUrl"
$sw = [Diagnostics.Stopwatch]::StartNew()
try {
  $ProgressPreference = 'Continue'
  Invoke-WebRequest -Uri $pkgUrl -OutFile $tmp -UseBasicParsing -TimeoutSec 300
} catch {
  Write-Host "  下载失败：$($_.Exception.Message)" -ForegroundColor Red
  Write-Host '  可以再运行一次本脚本重试。'
  Read-Host '  按回车退出'
  exit 1
}
$sec = [int]$sw.Elapsed.TotalSeconds
Write-Host "  [OK] 下载完成，${sec}s" -ForegroundColor Green

# 3) 校验
if ($manifest.sha256) {
  $sha = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
  if ($sha -ne $manifest.sha256.ToLower()) {
    Write-Host '  校验失败：文件不完整，请重试。' -ForegroundColor Red
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    Read-Host '  按回车退出'
    exit 1
  }
  Write-Host '  [OK] 安装包校验通过' -ForegroundColor Green
}

# 4) 解压 + 覆盖（config.json 不动）
$stage = Join-Path $env:TEMP ('xiaoxi-upd-stage-' + [guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $tmp -DestinationPath $stage -Force
$srcDir = Join-Path $stage 'xiaoxi-ai-live'
if (-not (Test-Path $srcDir)) { $srcDir = $stage }

Write-Host '  正在替换文件…'
$changed = 0
Get-ChildItem $srcDir -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($srcDir.Length + 1)
  if ($_.Name -eq 'config.json') { return }   # 客户配置绝不覆盖
  $dst = Join-Path $root $rel
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Copy-Item $_.FullName $dst -Force
  $changed++
}
Set-Content -Path $verFile -Value $manifest.version -Encoding UTF8 -NoNewline
Write-Host "  [OK] 已更新 $changed 个文件 → $($manifest.version)" -ForegroundColor Green

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $tmp -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '  更新完成！' -ForegroundColor Cyan
Write-Host '  现在请：关掉那个黑色服务窗口，重新双击 启动.cmd'
Write-Host ''
Read-Host '  按回车退出'
