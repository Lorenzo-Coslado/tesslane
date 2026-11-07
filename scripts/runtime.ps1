# Dot-sourced by start.ps1. No system installation or administrator rights.
$TesslaneUseHost = $false
if ($env:TESSLANE_MANAGED_NODE -ne '1' -and (Get-Command node -ErrorAction SilentlyContinue)) {
  node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'
  $TesslaneUseHost = $LASTEXITCODE -eq 0
}
if (-not $TesslaneUseHost) {
  $TesslaneVersion = (Get-Content (Join-Path $TesslaneRepo 'scripts/runtime-version') -Raw).Trim()
  $TesslaneArch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
  $TesslaneName = "node-v$TesslaneVersion-win-$TesslaneArch"
  $TesslaneRuntime = Join-Path $TesslaneRepo ".tesslane/runtime/$TesslaneName"
  if (-not (Test-Path (Join-Path $TesslaneRuntime 'node.exe'))) {
    $TesslaneTemp = Join-Path $TesslaneRepo ('.tesslane/runtime/download-' + [guid]::NewGuid())
    New-Item -ItemType Directory -Force $TesslaneTemp | Out-Null
    try {
      $TesslaneArchive = "$TesslaneName.zip"
      Write-Host 'Preparing a private Node.js runtime from nodejs.org…'
      Invoke-WebRequest "https://nodejs.org/dist/v$TesslaneVersion/$TesslaneArchive" -OutFile (Join-Path $TesslaneTemp $TesslaneArchive)
      $TesslaneSums = (Invoke-WebRequest "https://nodejs.org/dist/v$TesslaneVersion/SHASUMS256.txt").Content
      $TesslaneExpected = ($TesslaneSums -split "`n" | Where-Object { $_.Trim().EndsWith(" $TesslaneArchive") } | Select-Object -First 1).Trim().Split(' ')[0]
      $TesslaneActual = (Get-FileHash (Join-Path $TesslaneTemp $TesslaneArchive) -Algorithm SHA256).Hash.ToLowerInvariant()
      if (-not $TesslaneExpected -or $TesslaneExpected -ne $TesslaneActual) { throw 'Node.js archive checksum mismatch.' }
      Expand-Archive (Join-Path $TesslaneTemp $TesslaneArchive) -DestinationPath $TesslaneTemp
      Move-Item (Join-Path $TesslaneTemp $TesslaneName) $TesslaneRuntime
    } finally { Remove-Item -Recurse -Force $TesslaneTemp }
  }
  $env:Path = $TesslaneRuntime + [IO.Path]::PathSeparator + $env:Path
}
