# 拉取 unfetch 运行依赖的第三方二进制：yt-dlp + ffmpeg
# 用法：在仓库根目录执行 `pwsh scripts/fetch-binaries.ps1`

$ErrorActionPreference = 'Stop'
$core = Join-Path $PSScriptRoot '..\core'
$core = Resolve-Path $core

function Download($url, $dest) {
  if (Test-Path $dest) {
    Write-Host "  exists: $dest" -ForegroundColor Yellow
    return
  }
  Write-Host "  downloading $url" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
  Write-Host "  saved → $dest" -ForegroundColor Green
}

Write-Host "=== yt-dlp ===" -ForegroundColor Cyan
Download 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' (Join-Path $core 'yt-dlp.exe')

Write-Host "`n=== ffmpeg + ffprobe (gyan.dev 静态构建) ===" -ForegroundColor Cyan
$zip = Join-Path $env:TEMP 'ffmpeg-release.zip'
if (-not (Test-Path (Join-Path $core 'ffmpeg.exe')) -or -not (Test-Path (Join-Path $core 'ffprobe.exe'))) {
  Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $zip -UseBasicParsing
  $extractDir = Join-Path $env:TEMP 'ffmpeg-extract'
  Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -Path $zip -DestinationPath $extractDir -Force
  $ffmpegExe = Get-ChildItem $extractDir -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
  $ffprobeExe = Get-ChildItem $extractDir -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1
  if ($ffmpegExe)  { Copy-Item $ffmpegExe.FullName  (Join-Path $core 'ffmpeg.exe')  -Force }
  if ($ffprobeExe) { Copy-Item $ffprobeExe.FullName (Join-Path $core 'ffprobe.exe') -Force }
  Remove-Item $zip -Force
  Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "  ffmpeg / ffprobe ready in $core" -ForegroundColor Green
} else {
  Write-Host "  ffmpeg / ffprobe already present" -ForegroundColor Yellow
}

Write-Host "`n done." -ForegroundColor Green
