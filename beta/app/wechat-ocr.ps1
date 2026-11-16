param([int]$IntervalMs = 2500, [int]$MaxCycles = 0)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WXOcrCap {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
}
'@
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataWriter, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($op, $type) {
  $m = $asTaskGeneric.MakeGenericMethod($type)
  $task = $m.Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}
$lang = New-Object Windows.Globalization.Language('zh-Hans-CN')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if (-not $engine) { Write-Output 'NO_OCR'; exit 1 }

$cycles = 0
$lastHash = ''
while ($true) {
  $p = Get-Process finderlive -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $p) { Write-Output 'NO_APP'; Start-Sleep -Milliseconds $IntervalMs; continue }
  try {
    $r = New-Object WXOcrCap+RECT
    [WXOcrCap]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
    $w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
    if ($w -lt 300 -or $h -lt 200) { Start-Sleep -Milliseconds $IntervalMs; continue }
    $full = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($full)
    $hdc = $g.GetHdc()
    [WXOcrCap]::PrintWindow($p.MainWindowHandle, $hdc, 2) | Out-Null
    $g.ReleaseHdc($hdc); $g.Dispose()
    $x0 = [int]($w * 0.70); $y0 = [int]($h * 0.62)
    $cw = [int]($w * 0.295); $ch = [int]($h * 0.33)
    $crop = New-Object System.Drawing.Bitmap($cw, $ch)
    $cg = [System.Drawing.Graphics]::FromImage($crop)
    $cg.DrawImage($full, (New-Object System.Drawing.Rectangle(0,0,$cw,$ch)), (New-Object System.Drawing.Rectangle($x0,$y0,$cw,$ch)), [System.Drawing.GraphicsUnit]::Pixel)
    $cg.Dispose(); $full.Dispose()
    # 画面没变化就不做 OCR，避免空转占 CPU
    $hashMs = New-Object System.IO.MemoryStream
    $crop.Save($hashMs, [System.Drawing.Imaging.ImageFormat]::Png)
    $hashBytes = $hashMs.ToArray(); $hashMs.Dispose()
    $hash = [BitConverter]::ToString([System.Security.Cryptography.SHA1]::Create().ComputeHash($hashBytes))
    if ($hash -eq $lastHash) {
      $crop.Dispose()
      Write-Output 'FRAME_END'
      $cycles++
      if ($MaxCycles -gt 0 -and $cycles -ge $MaxCycles) { break }
      Start-Sleep -Milliseconds $IntervalMs
      continue
    }
    $lastHash = $hash
    $scale = 3
    $big = New-Object System.Drawing.Bitmap(($cw*$scale),($ch*$scale))
    $bg = [System.Drawing.Graphics]::FromImage($big)
    $bg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $bg.DrawImage($crop, 0, 0, $big.Width, $big.Height)
    $bg.Dispose(); $crop.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $big.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray(); $ms.Dispose(); $big.Dispose()

    $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $writer = New-Object Windows.Storage.Streams.DataWriter($stream)
    $writer.WriteBytes($bytes)
    Await ($writer.StoreAsync()) ([uint32]) | Out-Null
    $writer.DetachStream() | Out-Null
    $stream.Seek(0)
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $software = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($software)) ([Windows.Media.Ocr.OcrResult])
    foreach ($line in $result.Lines) {
      $t = $line.Text.Trim()
      if ($t) { Write-Output ('TEXT|' + $t) }
    }
    Write-Output 'FRAME_END'
  } catch {
    Write-Output ('OCR_ERR|' + $_.Exception.Message)
  }
  $cycles++
  if ($MaxCycles -gt 0 -and $cycles -ge $MaxCycles) { break }
  Start-Sleep -Milliseconds $IntervalMs
}
