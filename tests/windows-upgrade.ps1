# Integration test on a disposable GitHub-hosted Windows runner only.
$ErrorActionPreference = 'Stop'
if (-not $env:GITHUB_ACTIONS -or $env:RUNNER_OS -ne 'Windows') { throw 'Run this installer test only on the disposable Windows CI runner.' }
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class UpgradeWizard {
 public delegate bool EnumProc(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr p);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder b, int max);
 [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb,IntPtr p);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 public static IntPtr InstallerWindow(){IntPtr root=IntPtr.Zero;EnumWindows((h,p)=>{var b=new StringBuilder(512);GetWindowText(h,b,512);if(IsWindowVisible(h)&&b.ToString().StartsWith("Checkpoint Studio Setup")){root=h;return false;}return true;},IntPtr.Zero);return root;}
 public static string VisibleWindows(){var s=new StringBuilder();EnumWindows((h,p)=>{if(IsWindowVisible(h)){var b=new StringBuilder(512);GetWindowText(h,b,512);s.AppendLine("WINDOW: "+b.ToString());s.AppendLine(Text(h));}return true;},IntPtr.Zero);return s.ToString();}
 public static string Text(IntPtr root) {
  var text=new StringBuilder();
  EnumChildWindows(root,(h,p)=>{var b=new StringBuilder(2048);GetWindowText(h,b,2048);text.AppendLine(b.ToString());return true;},IntPtr.Zero);
  return text.ToString();
 }
 public static void Click(IntPtr root,int id){var h=GetDlgItem(root,id);if(h==IntPtr.Zero||!IsWindowEnabled(h))throw new Exception("Wizard button unavailable: "+id);SetForegroundWindow(root);PostMessage(root,0x111,new IntPtr(id),h);}
}
'@
$version = (Get-Content package.json | ConvertFrom-Json).version
$base = Join-Path $env:RUNNER_TEMP ('checkpoint-upgrade-' + [guid]::NewGuid())
$oldDir = Join-Path $base 'old\Checkpoint Studio'
$newDir = Join-Path $base 'new\Checkpoint Studio'
$projectDir = Join-Path $base 'protected-project'
New-Item $projectDir -ItemType Directory -Force | Out-Null
$project = Join-Path $projectDir 'project.checkpoint'
$projectContent = '{"version":1,"name":"Upgrade safety sentinel","takes":[],"clips":[]}'
Set-Content $project $projectContent
$settings = @('checkpoint-studio','Checkpoint Studio') | ForEach-Object { Join-Path $env:APPDATA "$_\upgrade-test.txt" }
foreach ($file in $settings) { New-Item (Split-Path $file) -ItemType Directory -Force | Out-Null; Set-Content $file 'preserve-settings' }
$oldInstaller = Join-Path $base 'previous.exe'
Invoke-WebRequest 'https://github.com/xdmqxi/checkpoint-studio/releases/download/v0.6.0/Checkpoint-Studio-Windows-x64-Setup.exe' -OutFile $oldInstaller
Write-Output 'Installing previous version 0.6.0 in isolated test directory'
$old = Start-Process $oldInstaller -ArgumentList "/S /currentuser /D=$oldDir" -PassThru
if (-not $old.WaitForExit(180000) -or $old.ExitCode -ne 0) { throw 'Previous version installation failed' }
if (-not (Test-Path (Join-Path $oldDir 'Checkpoint Studio.exe'))) { throw 'Previous application missing' }
$installer = (Resolve-Path "release/Checkpoint-Studio-$version-Windows-x64-Setup.exe").Path
# First use the real interactive wizard and verify its detected previous version.
Write-Output 'Opening upgrade wizard'
$wizard = Start-Process $installer -ArgumentList "/currentuser /D=$newDir" -PassThru
$found = $false
for ($i=0; $i -lt 30; $i++) {
 Start-Sleep -Milliseconds 500
 $wizard.Refresh()
 if ($wizard.HasExited) { throw 'Wizard closed before upgrade page' }
 if (([UpgradeWizard]::InstallerWindow()) -eq [IntPtr]::Zero) { continue }
 $text = [UpgradeWizard]::Text(([UpgradeWizard]::InstallerWindow()))
 if ($text -match 'Vorhandene Version: 0\.6\.0' -and $text -match 'Bisherige Programmversion automatisch entfernen') { $found=$true; break }
 if ($i -gt 1 -and $i % 3 -eq 0) { Write-Output "Advancing wizard: $text"; [UpgradeWizard]::Click(([UpgradeWizard]::InstallerWindow()),1) }
}
if (-not $found) { throw "Previous-version page not found. Wizard text: $text" }
Write-Output 'PASS: real NSIS wizard detects and explains replacement of version 0.6.0'
# Continue through Install and Finish, then close only the disposable test app.
for ($i=0; $i -lt 120; $i++) {
 $wizard.Refresh();if($wizard.HasExited){break}
 if($i % 10 -eq 0){Write-Output "Upgrade progress: $([UpgradeWizard]::VisibleWindows())"}
 $next=[UpgradeWizard]::GetDlgItem(([UpgradeWizard]::InstallerWindow()),1)
 if($next -ne [IntPtr]::Zero -and [UpgradeWizard]::IsWindowEnabled($next)){[UpgradeWizard]::Click(([UpgradeWizard]::InstallerWindow()),1)}
 Start-Sleep -Milliseconds 1000
}
$wizard.Refresh();if(-not $wizard.HasExited){throw "Upgrade wizard did not finish. $([UpgradeWizard]::VisibleWindows())"}
if($wizard.ExitCode -ne 0){throw "Upgrade failed: $($wizard.ExitCode)"}
# Stop only a test-app process launched from our disposable installation directory.
Get-Process 'Checkpoint Studio' -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$newDir*" } | Stop-Process -Force
if(Test-Path (Join-Path $oldDir 'Checkpoint Studio.exe')){throw 'Old application executable was left behind'}
$exe=Join-Path $newDir 'Checkpoint Studio.exe'
if(-not(Test-Path $exe)){throw 'Updated application executable missing'}
if((Get-Item $exe).VersionInfo.ProductVersion -notlike "$version*"){throw 'Installed executable has wrong version'}
foreach($file in $settings){if((Get-Content $file -Raw).Trim() -ne 'preserve-settings'){throw 'Settings were removed'}}
if((Get-Content $project -Raw).Trim() -ne $projectContent){throw 'External project was modified'}
# The same application identity must have one uninstall registration after upgrade.
$roots=@('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')
$entries=@($roots | Where-Object {Test-Path $_} | ForEach-Object {Get-ChildItem $_} | Get-ItemProperty | Where-Object {$_.DisplayName -eq 'Checkpoint Studio'})
if($entries.Count -ne 1){throw "Expected one installed application entry, found $($entries.Count)"}
if($entries[0].DisplayVersion -ne $version){throw 'Uninstall entry has wrong version'}
Write-Output "PASS: upgrade 0.6.0 -> $version replaces old program folder, preserves settings and project, leaves one installed-app entry"
