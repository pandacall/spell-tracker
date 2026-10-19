# Creates a "Spell Tracker" shortcut on the desktop that launches the app.
# Run `npm run shortcut` (which builds first). It does not register the app to
# start with Windows.
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) { throw "electron.exe not found. Run npm install first." }
if (-not (Test-Path (Join-Path $projectRoot 'dist\main\main.js'))) { throw "App not built. Run npm run build first." }

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Spell Tracker.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electron
$shortcut.Arguments = "`"$projectRoot`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Spell Tracker overlay'
$shortcut.Save()
Write-Host "Created $shortcutPath"
