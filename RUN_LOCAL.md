# 로컬 실행 가이드 — 서버 켜기 (도움 없이 혼자)

이 앱은 **서버 3개**로 동작하며, 전부 이 노트북에서 실행됩니다.

| 서버 | 포트 | 역할 |
|---|---|---|
| Ollama | 11434 | 로컬 AI 모델(qwen2.5, **D드라이브**에 저장) |
| 백엔드 (FastAPI) | 8000 | API · 시뮬레이션 |
| 프론트 (Vite) | 5173 | 화면 — 브라우저로 접속하는 곳 |

---

## ① 빠른 실행 (한 번에)

폴더의 **`start-local.ps1`** 를 우클릭 → **PowerShell에서 실행**.
또는 PowerShell을 열고:

```powershell
cd D:\Claude\GameGoal
./start-local.ps1
```

→ Ollama가 켜지고, 백엔드·프론트가 각각 새 창으로 뜹니다.
→ 잠시 후 브라우저에서 **http://localhost:5173**

> 스크립트가 "실행 정책" 때문에 막히면, PowerShell에서 한 번만:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (Y 입력)

---

## ② 수동 실행 (하나씩 직접)

**1) Ollama** — 보통 부팅 시 자동 실행됨(트레이 아이콘). 안 떠 있으면 시작 메뉴에서 **"Ollama"** 실행.
   - 모델은 `D:\Ollama\models` 에 있음(환경변수 `OLLAMA_MODELS`로 영구 지정됨).

**2) 백엔드** — PowerShell 새 창:
```powershell
cd D:\Claude\GameGoal\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**3) 프론트** — PowerShell 새 창:
```powershell
cd D:\Claude\GameGoal\frontend
npm run dev
```

→ 브라우저: **http://localhost:5173**

---

## ③ 다른 기기(같은 집 LAN)에서 보기

1. 노트북 IP 확인 — PowerShell에서 `ipconfig` → **Wi-Fi**의 `IPv4 주소`(예: `192.168.35.31`)
2. 다른 기기 브라우저에서 → **http://<노트북IP>:5173**
3. 방화벽은 이미 1회 열어둠(규칙명 `GameGoal Vite 5173`). 혹시 없어졌으면 **관리자 PowerShell**에서:
   ```powershell
   New-NetFirewallRule -DisplayName "GameGoal Vite 5173" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Any
   ```

> ⚠️ **중요:** 두 기기가 **같은 공유기 = 같은 서브넷**이어야 직접 접속됩니다.
> 노트북이 `192.168.35.x` / 게이트웨이 `192.168.35.1` 이면, 다른 기기도 `192.168.35.x` + 같은 게이트웨이여야 함.
> 다르면(예: 한쪽이 `192.168.0.x`) 공유기가 분리된 것 → 같은 WiFi에 붙이거나 Tailscale 사용.

---

## ④ 종료

각 서버 창을 닫거나 그 창에서 `Ctrl + C`. Ollama는 트레이 아이콘 우클릭 → Quit.

---

## ⑤ AI 모델 / 프로바이더 바꾸기

`backend\.env` 편집 후 **백엔드만 재시작**:

```ini
# 로컬 무료(권장 개발) vs gpt-5(배포·품질)
LLM_PROVIDER=ollama        # 또는 github

# 안정·느림(~19s) vs 빠름·가끔 언어붕괴(~3s)
OLLAMA_MODEL=qwen2.5:14b-instruct   # 또는 qwen2.5:7b-instruct
```

---

## ⑥ 문제 해결

- **AI가 "현재 API를 호출할 수 없습니다"만 나옴**
  → 백엔드가 Ollama를 못 찾는 것. 브라우저로 `http://localhost:11434/api/tags` 열어 모델 목록이 비어 있으면 **Ollama 재시작**.
  (트레이 Ollama가 C드라이브 빈 폴더로 켜졌을 수 있음 → Quit 후 다시 실행)

- **다른 기기에서 접속 안 됨**
  1. 두 기기 `ipconfig`의 **Default Gateway가 같은지** 확인(다르면 다른 네트워크).
  2. 공유기의 **AP 격리 / 게스트망**이 켜져 있으면 끄기.
  3. 노트북 IP가 바뀌었는지 `ipconfig`로 재확인.
  4. 노트북에서 방화벽 규칙(`GameGoal Vite 5173`)이 살아있는지 확인.

- **포트가 이미 사용 중**
  → 같은 서버가 이미 떠 있음. 기존 창을 닫고 다시 실행.

- **첫 AI 호출이 느림(~30초)**
  → 14b 모델을 VRAM에 올리는 시간. 이후 호출은 ~19초. 더 빠르게 하려면 `.env`에서 7b로.
