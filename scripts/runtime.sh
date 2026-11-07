#!/usr/bin/env bash
# Sourced by start.sh. Keep the host runtime untouched.
if [[ "${TESSLANE_MANAGED_NODE:-0}" != 1 ]] && command -v node >/dev/null 2>&1 && node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' >/dev/null 2>&1; then
  return 0
fi
tesslane_version="$(tr -d '[:space:]' < "$tesslane_repo/scripts/runtime-version")"
case "$(uname -s)" in Darwin) tesslane_os=darwin ;; Linux) tesslane_os=linux ;; *) echo 'Unsupported OS; use start.ps1 on Windows.' >&2; return 1 ;; esac
case "$(uname -m)" in arm64|aarch64) tesslane_arch=arm64 ;; x86_64|amd64) tesslane_arch=x64 ;; *) echo 'Managed Node supports x64 and arm64.' >&2; return 1 ;; esac
tesslane_runtime="$tesslane_repo/.tesslane/runtime/node-v$tesslane_version-$tesslane_os-$tesslane_arch"
if [[ ! -x "$tesslane_runtime/bin/node" ]]; then
  command -v curl >/dev/null || { echo 'curl is required to prepare the local runtime.' >&2; return 1; }
  mkdir -p "$tesslane_repo/.tesslane/runtime"
  tesslane_download="$(mktemp -d "$tesslane_repo/.tesslane/runtime/download.XXXXXX")"
  tesslane_archive="node-v$tesslane_version-$tesslane_os-$tesslane_arch.tar.gz"
  echo 'Preparing a private Node.js runtime from nodejs.org…' >&2
  curl --proto '=https' --tlsv1.2 -fsS --retry 2 --max-time 180 "https://nodejs.org/dist/v$tesslane_version/$tesslane_archive" -o "$tesslane_download/$tesslane_archive"
  curl --proto '=https' --tlsv1.2 -fsS --retry 2 --max-time 30 "https://nodejs.org/dist/v$tesslane_version/SHASUMS256.txt" -o "$tesslane_download/SHASUMS256.txt"
  tesslane_expected="$(awk -v file="$tesslane_archive" '$2 == file { print $1 }' "$tesslane_download/SHASUMS256.txt")"
  if command -v sha256sum >/dev/null 2>&1; then tesslane_actual="$(sha256sum "$tesslane_download/$tesslane_archive" | awk '{print $1}')";
  else tesslane_actual="$(shasum -a 256 "$tesslane_download/$tesslane_archive" | awk '{print $1}')"; fi
  [[ -n "$tesslane_expected" && "$tesslane_expected" == "$tesslane_actual" ]] || { echo 'Node.js archive checksum mismatch.' >&2; return 1; }
  tar -xzf "$tesslane_download/$tesslane_archive" -C "$tesslane_download"
  mv "$tesslane_download/node-v$tesslane_version-$tesslane_os-$tesslane_arch" "$tesslane_runtime"
  rm -rf -- "$tesslane_download"
fi
export PATH="$tesslane_runtime/bin:$PATH"
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'
