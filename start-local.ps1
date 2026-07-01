# start-local.ps1 — GameGoal 로컬 서버(Ollama + 백엔드 + 프론트) 한 번에 실행 + 브라우저 자동 열기
# 보통은 "GameGoal 실행.bat" 또는 "GameGoal.exe" 더블클릭으로 실행한다.
# 이미 떠 있는 서버는 건너뛰므로 아무 때나 실행해도 안전하다.

$ErrorActionPreference = "SilentlyContinue"

# 스크립트 위치(=프로젝트 루트). exe로 컴파일되면 $PSScriptRoot가 비므로 하드코딩 폴백.
$root = $PSScriptRoot
if (-not $root -or -not (Test-Path (Join-Path $root "backend"))) { $root = "D:\Claude\GameGoal" }

function Test-Port($p) { [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) }

Write-Host "=== GameGoal 시작 (루트: $root) ===" -ForegroundColor Cyan

# 1) Ollama (모델은 D드라이브)
$env:OLLAMA_MODELS = "D:\Ollama\models"
$ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (Get-Process -Name "ollama" -ErrorAction SilentlyContinue) {
    Write-Host "[1/3] Ollama 이미 실행 중" -ForegroundColor Green
} elseif (Test-Path $ollamaExe) {
    Start-Process $ollamaExe -ArgumentList "serve" -WindowStyle Minimized
    Write-Host "[1/3] Ollama 시작 (D:\Ollama\models)" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/3] Ollama 실행파일 못 찾음 — 시작 메뉴에서 수동 실행" -ForegroundColor Yellow
}

# 2) 백엔드 (FastAPI) — 8000 사용 중이면 건너뜀
if (Test-Port 8000) {
    Write-Host "[2/3] 백엔드 이미 실행 중 (http://localhost:8000)" -ForegroundColor Green
} else {
    $backendCmd = "Set-Location -LiteralPath '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
    Write-Host "[2/3] 백엔드 시작 (http://localhost:8000)" -ForegroundColor Green
}

# 3) 프론트 (Vite) — 5173 사용 중이면 건너뜀
if (Test-Port 5173) {
    Write-Host "[3/3] 프론트 이미 실행 중 (http://localhost:5173)" -ForegroundColor Green
} else {
    $frontendCmd = "Set-Location -LiteralPath '$root\frontend'; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
    Write-Host "[3/3] 프론트 시작 (http://localhost:5173)" -ForegroundColor Green
}

# 프론트가 응답할 때까지 대기 후 브라우저 자동 오픈
Write-Host ""
Write-Host "프론트 준비 대기 중" -ForegroundColor Cyan -NoNewline
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
    try { Invoke-WebRequest "http://127.0.0.1:5173" -TimeoutSec 2 -UseBasicParsing | Out-Null; $ready = $true; break }
    catch { Start-Sleep -Seconds 1; Write-Host "." -NoNewline }
}
Write-Host ""
if ($ready) {
    Start-Process "http://localhost:5173"
    Write-Host "✔ 브라우저를 열었습니다: http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "프론트가 아직 준비 안 됨 — 잠시 후 http://localhost:5173 수동 접속" -ForegroundColor Yellow
}

# 접속 주소 안내(LAN / Tailscale)
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
       Select-Object -First 1).IPAddress
$tsIp = (& "C:\Program Files\Tailscale\tailscale.exe" ip -4 2>$null | Select-Object -First 1)
Write-Host ""
Write-Host "접속 주소:" -ForegroundColor Cyan
Write-Host "  이 PC          : http://localhost:5173"
if ($ip)   { Write-Host "  같은 LAN 기기  : http://$ip`:5173" }
if ($tsIp) { Write-Host "  원격(Tailscale): http://$tsIp`:5173   (양쪽 Tailscale 켜져 있을 때)" }
Write-Host ""
Write-Host "종료하려면: 백엔드/프론트 창을 닫으세요. (Ollama는 트레이 아이콘 우클릭 Quit)" -ForegroundColor DarkGray
Start-Sleep -Seconds 3
