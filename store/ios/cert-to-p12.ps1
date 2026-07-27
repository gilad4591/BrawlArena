# One-time, no-Mac step 2/2 of setting up the signed-archive job in
# .github/workflows/ios-build.yml.
#
# Converts the .cer downloaded from Apple Developer (after uploading the CSR
# from generate-csr.ps1) into a password-protected .p12, and prints it as
# base64 -- ready to paste into the GitHub secret IOS_DIST_CERT_BASE64
# (the password you choose below is the separate IOS_DIST_CERT_PASSWORD
# secret).
#
# Usage:
#   .\cert-to-p12.ps1 -CerPath .\distribution.cer -P12Password "choose-a-password"

param(
  [Parameter(Mandatory = $true)][string]$CerPath,
  [Parameter(Mandatory = $true)][string]$P12Password,
  [string]$KeyPath = (Join-Path $PSScriptRoot "ios_distribution.key"),
  [string]$OutDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
  Write-Error "openssl not found on PATH. Run this from 'Git Bash', or install OpenSSL for Windows."
}
if (-not (Test-Path $CerPath)) { Write-Error "Missing $CerPath" }
if (-not (Test-Path $KeyPath)) { Write-Error "Missing $KeyPath -- run generate-csr.ps1 first (same machine/key)." }

$pemPath = Join-Path $OutDir "distribution.pem"
$p12Path = Join-Path $OutDir "distribution.p12"

& openssl x509 -inform DER -outform PEM -in $CerPath -out $pemPath

# OpenSSL 3.x defaults to AES-256-CBC + SHA-256 MAC for PKCS12 export. macOS's
# Keychain import (`security import`, used by ios-build.yml's signed-archive
# job) can't read that and fails with a misleading "MAC verification failed
# (wrong password?)" even when the password is correct. Forcing the classic
# pbeWithSHA1And3-KeyTripleDES-CBC scheme (what `security import` expects)
# avoids needing OpenSSL's separate "legacy" provider module, which most
# Windows OpenSSL builds (e.g. the one bundled with Git for Windows) don't
# ship at all.
& openssl pkcs12 -export -inkey $KeyPath -in $pemPath -out $p12Path -password "pass:$P12Password" `
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg SHA1

Write-Host "Wrote $p12Path"
Write-Host ""
Write-Host "GitHub secret IOS_DIST_CERT_PASSWORD = $P12Password"
Write-Host "GitHub secret IOS_DIST_CERT_BASE64 (copy the whole block below):"
Write-Host ""
[Convert]::ToBase64String([IO.File]::ReadAllBytes($p12Path))
