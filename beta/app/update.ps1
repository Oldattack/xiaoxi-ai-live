# 一键更新：读完 update-url.txt 里的地址，拉新版本
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
# 端口跟本安装目录走（同机可能装两套，别写死 8792 打到别人的实例上）
$port = 8792
try {
  $raw = Get-Content (Join-Path $here 'config.json') -Raw -Encoding UTF8 -ErrorAction Stop
  if ($null -ne $raw -and $raw -is [string] -and $raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
  $cfg = ConvertFrom-Json $raw
  if ($cfg.port) { $port = [int]$cfg.port }
} catch { }
$base = 'http://127.0.0.1:' + $port
Write-Host ('服务端口：' + $port)
$url = ''
$f = Join-Path $here 'update-url.txt'
if (Test-Path $f) { $url = (Get-Content $f -Raw).Trim() }
if (-not $url) { Write-Host '没有配置更新地址（update-url.txt）'; exit 1 }
try {
  $r = Invoke-RestMethod -Method Post -Uri ($base + '/api/update/check') -Body (@{manifestUrl=$url} | ConvertTo-Json) -ContentType 'application/json'
  # 注意：这里绝对不能用双竖线（PowerShell 5.1 会在「解析阶段」直接报错，整个脚本一行都不执行，
  # 客户看到的现象是双击一键更新毫无反应）。多级兜底一律写成顺序判断。
  if ($r -and $r.ok -eq $false) { $msg = $r.reason; if (-not $msg) { $msg = $r.error }; if (-not $msg) { $msg = '检查失败' }; Write-Host ('更新失败：' + $msg); exit 1 }
  if (-not $r.hasUpdate) { Write-Host ('已经是最新版 ' + $r.current); exit 0 }
  Write-Host ('发现新版本 ' + $r.latest + '，正在下载…')
  $a = Invoke-RestMethod -Method Post -Uri ($base + '/api/update/apply') -Body '{}' -ContentType 'application/json'
  if ($a -and $a.ok -eq $false) { $msg = $a.error; if (-not $msg) { $msg = '服务拒绝' }; Write-Host ('更新失败：' + $msg); exit 1 }
  Write-Host '更新完成，服务正在重启（十几秒后可用）'
} catch { Write-Host ('更新失败：' + $_.Exception.Message); exit 1 }
