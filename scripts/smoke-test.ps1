# Üretilen kelime.exe'yi başlatır; açılış, veritabanı ve boştaki kaynak kullanımını ölçer.
param([string]$Exe = "src-tauri/target/release/kelime.exe")
$ErrorActionPreference = "Stop"

function Tree-Stats($rootId) {
  # kelime.exe + altındaki WebView2 süreçleri
  $all = Get-CimInstance Win32_Process
  $ids = @($rootId)
  do {
    $added = $all | Where-Object { $ids -contains $_.ParentProcessId -and -not ($ids -contains $_.ProcessId) } | ForEach-Object { $_.ProcessId }
    $ids += $added
  } while ($added)
  $procs = $ids | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
  [pscustomobject]@{
    Count = $procs.Count
    PrivateMB = [math]::Round((($procs | Measure-Object PrivateMemorySize64 -Sum).Sum) / 1MB, 1)
    WorkingSetMB = [math]::Round((($procs | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 1)
    CpuSec = [math]::Round((($procs | Measure-Object CPU -Sum).Sum), 2)
  }
}

$sw = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath $Exe -PassThru
$db = Join-Path $env:APPDATA "com.omerfarukoktay.kelime\kelime.db"
while (-not (Test-Path $db) -and $sw.Elapsed.TotalSeconds -lt 20) { Start-Sleep -Milliseconds 100 }
$dbMs = $sw.ElapsedMilliseconds
if (-not (Test-Path $db)) { throw "Veritabanı oluşmadı: $db" }

# Pencere görünür olana kadar bekle (ön yüz 'window_ready' çağırınca açılır)
while ($sw.Elapsed.TotalSeconds -lt 20) {
  $p.Refresh()
  if ($p.MainWindowHandle -ne 0) { break }
  Start-Sleep -Milliseconds 100
}
$windowMs = $sw.ElapsedMilliseconds
if ($p.HasExited) { throw "Uygulama kapandı (çıkış kodu $($p.ExitCode))" }

Start-Sleep -Seconds 8
$a = Tree-Stats $p.Id
Start-Sleep -Seconds 20
$b = Tree-Stats $p.Id
$idleCpu = [math]::Round(($b.CpuSec - $a.CpuSec) / 20 * 100, 2)

# Simge durumuna küçült (WebView2 askıya alınır) ve tekrar ölç
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class W { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); }
"@
[W]::ShowWindow($p.MainWindowHandle, 6) | Out-Null
Start-Sleep -Seconds 8
$c = Tree-Stats $p.Id
Start-Sleep -Seconds 20
$d = Tree-Stats $p.Id
$minCpu = [math]::Round(($d.CpuSec - $c.CpuSec) / 20 * 100, 2)

# Kapat düğmesi: uygulama kapanmamalı, tepsiye gizlenmeli
$hwnd = $p.MainWindowHandle
[W]::ShowWindow($hwnd, 9) | Out-Null   # geri getir
Start-Sleep -Seconds 3
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class M { [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l); }
"@
[M]::PostMessage($hwnd, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null   # WM_CLOSE
Start-Sleep -Seconds 8
$p.Refresh()
if ($p.HasExited) { throw "Kapat düğmesi uygulamayı kapattı (tepsiye gizlenmeliydi)" }
$e = Tree-Stats $p.Id
Start-Sleep -Seconds 20
$f = Tree-Stats $p.Id
$trayCpu = [math]::Round(($f.CpuSec - $e.CpuSec) / 20 * 100, 2)

$exeMB = [math]::Round((Get-Item $Exe).Length / 1MB, 1)
$setup = Get-ChildItem "src-tauri/target/release/bundle/nsis/*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$setupMB = if ($setup) { [math]::Round($setup.Length / 1MB, 1) } else { "?" }

$report = @"
kelime Windows duman testi
--------------------------
Veritabanı hazır          : $dbMs ms
Pencere görünür           : $windowMs ms
Süreç sayısı              : $($b.Count)  (kelime.exe + WebView2)
Bellek (açık, boşta)      : $($b.PrivateMB) MB özel / $($b.WorkingSetMB) MB çalışma kümesi
CPU (açık, boşta, 20 sn)  : %$idleCpu (tek çekirdeğe göre)
Bellek (simge durumunda)  : $($d.PrivateMB) MB özel / $($d.WorkingSetMB) MB çalışma kümesi
CPU (simge durumunda)     : %$minCpu
Bellek (tepside gizli)    : $($f.PrivateMB) MB özel / $($f.WorkingSetMB) MB çalışma kümesi
CPU (tepside gizli)       : %$trayCpu
kelime.exe                : $exeMB MB
Kurulum dosyası           : $setupMB MB
"@
Write-Output $report
$report | Out-File -Encoding utf8 smoke-report.txt

Stop-Process -Id $p.Id -Force
if ($idleCpu -gt 5) { throw "Boştayken CPU çok yüksek: %$idleCpu" }
if ($trayCpu -gt 2) { throw "Tepsideyken CPU çok yüksek: %$trayCpu" }
