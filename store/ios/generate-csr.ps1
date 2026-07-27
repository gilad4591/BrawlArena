# One-time, no-Mac step 1/2 of setting up the signed-archive job in
# .github/workflows/ios-build.yml (see ../../.github/workflows/ios-build.yml
# and store/ios/README.md for the full checklist).
#
# Generates a private key + Certificate Signing Request (CSR) using OpenSSL
# -- the same CSR format Xcode's "Keychain Access" would produce, just
# without needing a Mac. Requires OpenSSL (bundled with Git for Windows --
# usually on PATH inside "Git Bash" -- or install from
# https://slproweb.com/products/Win32OpenSSL.html for plain PowerShell).
#
# Usage:
#   .\generate-csr.ps1 -Email "you@example.com" -Name "Your Name"
#
# Then: Apple Developer -> Certificates, Identifiers & Profiles ->
#   Certificates -> "+" -> Apple Distribution -> upload
#   ios_distribution.csr -> download the resulting .cer file.
# Next step: .\cert-to-p12.ps1 (converts that .cer into the .p12 CI needs).

param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$OutDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
  Write-Error "openssl not found on PATH. Run this from 'Git Bash', or install OpenSSL for Windows."
}

$keyPath = Join-Path $OutDir "ios_distribution.key"
$csrPath = Join-Path $OutDir "ios_distribution.csr"

if (Test-Path $keyPath) {
  Write-Warning "$keyPath already exists -- reusing it (delete it first to generate a brand new key)."
} else {
  & openssl genrsa -out $keyPath 2048
  Write-Host "Wrote $keyPath -- keep this private, never commit it (store/ios/*.key and *.p12 are gitignored)."
}

$subject = "/emailAddress=$Email/CN=$Name/C=US"
& openssl req -new -key $keyPath -out $csrPath -subj $subject

Write-Host ""
Write-Host "Wrote $csrPath"
Write-Host "Upload it at: https://developer.apple.com/account/resources/certificates/add"
Write-Host "  Certificate type: Apple Distribution"
Write-Host "After downloading the resulting .cer, run .\cert-to-p12.ps1"
