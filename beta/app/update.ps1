# 一键更新：读完 update-url.txt 里的地址，拉新版本
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$url = ''
$f = Join-Path $here 'update-url.txt'
if (Test-Path $f) { $url = (Get-Content $f -Raw).Trim() }
if (-not $url) { Write-Host '没有配置更新地址（update-url.txt）'; exit 1 }
try {
  $r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8792/api/update/check' -Body (@{manifestUrl=$url} | ConvertTo-Json) -ContentType 'application/json'
  if (-not $r.hasUpdate) { Write-Host ('已经是最新版 ' + $r.current); exit 0 }
  Write-Host ('发现新版本 ' + $r.latest + '，正在下载…')
  $a = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8792/api/update/apply' -Body '{}' -ContentType 'application/json'
  Write-Host '更新完成，服务正在重启（十几秒后可用）'
} catch { Write-Host ('更新失败：' + $_.Exception.Message) }
