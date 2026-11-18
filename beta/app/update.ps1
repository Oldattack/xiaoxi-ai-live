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
  if ($r -and $r.ok -eq $false) { Write-Host ('更新失败：' + ($r.reason || $r.error || '检查失败')); exit 1 }
  if (-not $r.hasUpdate) { Write-Host ('已经是最新版 ' + $r.current); exit 0 }
  Write-Host ('发现新版本 ' + $r.latest + '，正在下载…')
  $a = Invoke-RestMethod -Method Post -Uri ($base + '/api/update/apply') -Body '{}' -ContentType 'application/json'
  if ($a -and $a.ok -eq $false) { Write-Host ('更新失败：' + ($a.error || '服务拒绝')); exit 1 }
  Write-Host '更新完成，服务正在重启（十几秒后可用）'
} catch { Write-Host ('更新失败：' + $_.Exception.Message); exit 1 }
