param([string]$Project = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
$TesslaneRepo = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'runtime.ps1')
Push-Location $TesslaneRepo
try {
  node scripts/prepare.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Tesslane preparation failed.' }
  node scripts/launch.mjs $Project
  if ($LASTEXITCODE -ne 0) { throw 'Tesslane could not start.' }
} finally { Pop-Location }
