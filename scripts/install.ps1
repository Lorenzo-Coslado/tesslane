param([ValidateSet('codex', 'claude')][string]$Agent = 'codex')
$ErrorActionPreference = 'Stop'
$TesslaneRepo = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'runtime.ps1')
node (Join-Path $PSScriptRoot 'install-skill.mjs') $Agent
if ($LASTEXITCODE -ne 0) { throw 'Skill installation failed.' }
