# start-local.ps1 — GameGoal 로컬 서버 3개(Ollama + 백엔드 + 프론트) 한 번에 실행
# 사용법: 이 파일 우클릭 → "PowerShell에서 실행"  또는  PowerShell에서  ./start-local.ps1
# (자세한 내용은 RUN_LOCAL.md 참고)

$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot

Write-Host "=== GameGoal 로컬 서버 시작 ===" -ForegroundColor Cyan

# 1) Ollama (모델은 D드라이브) — 안 떠 있으면 serve 실행
$env:OLLAMA_MODELS = "D:\Ollama\models"
$ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (Get-Process -Name "ollama" -ErrorAction SilentlyContinue) {
    Write-Host "[1/3] Ollama 이미 실행 중" -ForegroundColor Green
} elseif (Test-Path $ollamaExe) {
    Start-Process $ollamaExe -ArgumentList "serve" -WindowStyle Minimized
    Write-Host "[1/3] Ollama 시작함 (D:\Ollama\models)" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/3] Ollama 실행파일을 못 찾음 — 시작 메뉴에서 Ollama 수동 실행 필요" -ForegroundColor Yellow
}

# 2) 백엔드 (FastAPI) — 새 PowerShell 창
$backendCmd = "Set-Location -LiteralPath '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Write-Host "[2/3] 백엔드 시작 (http://localhost:8000)" -ForegroundColor Green

# 3) 프론트 (Vite) — 새 PowerShell 창
$frontendCmd = "Set-Location -LiteralPath '$root\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Write-Host "[3/3] 프론트 시작 (http://localhost:5173)" -ForegroundColor Green

# 접속 주소 안내
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
       Select-Object -First 1).IPAddress
Write-Host ""
Write-Host "잠시(10~20초) 후 접속:" -ForegroundColor Cyan
Write-Host "  이 PC          : http://localhost:5173"
if ($ip) { Write-Host "  같은 LAN 기기  : http://$ip`:5173" }
Write-Host ""
Write-Host "종료: 각 서버 창을 닫으세요. (Ollama는 트레이 아이콘 우클릭 Quit)"
