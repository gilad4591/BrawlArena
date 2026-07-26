# Offline English narration generator for promo videos, using the modern
# Windows OneCore speech voices (Mark / Zira / David) via the WinRT
# Windows.Media.SpeechSynthesis API — noticeably less robotic than the
# classic SAPI "Desktop" voices exposed through System.Speech, and fully
# offline (no API key, no network call, no per-character cost).
#
# Usage: powershell -NoProfile -File tts.ps1 -Text "..." -OutFile out.wav [-VoiceName "Microsoft Mark"] [-Rate 0] [-Pitch 0]
param(
  [Parameter(Mandatory = $true)][string]$Text,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$VoiceName = 'Microsoft Mark',
  [double]$Rate = 1.0
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

function Await($WinRtTask, $ResultType) {
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $VoiceName } | Select-Object -First 1
if ($voice) { $synth.Voice = $voice } else { Write-Warning "voice '$VoiceName' not found, using default" }
$synth.Options.SpeakingRate = $Rate

# SSML gives more natural pacing (a short pause after punctuation) than raw
# text-to-speech with these voices.
$escaped = [System.Security.SecurityElement]::Escape($Text)
$ssml = "<speak version='1.0' xml:lang='en-US'><prosody rate='$Rate'>$escaped</prosody></speak>"

$stream = Await ($synth.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])

$inputStream = $stream.GetInputStreamAt(0)
$reader = New-Object Windows.Storage.Streams.DataReader($inputStream)
$size = [uint32]$stream.Size
Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
$buffer = New-Object byte[] $size
$reader.ReadBytes($buffer)
[System.IO.File]::WriteAllBytes($OutFile, $buffer)
Write-Output "wrote $OutFile ($($buffer.Length) bytes)"
