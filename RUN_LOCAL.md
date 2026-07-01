# 로컬 실행 가이드 — 서버 켜기 (도움 없이 혼자)

이 앱은 **서버 3개**로 동작하며, 전부 이 노트북에서 실행됩니다.

| 서버 | 포트 | 역할 |
|---|---|---|
| Ollama | 11434 | 로컬 AI 모델(qwen2.5, **D드라이브**에 저장) |
| 백엔드 (FastAPI) | 8000 | API · 시뮬레이션 |
| 프론트 (Vite) | 5173 | 화면 — 브라우저로 접속하는 곳 |

---

## ① 빠른 실행 (한 번에) — 더블클릭

폴더의 **`GameGoal.exe`** 를 더블클릭. (경고가 싫으면 **`GameGoal 실행.bat`**)

→ Ollama + 백엔드 + 프론트가 자동으로 켜지고(이미 떠 있으면 건너뜀), 준비되면 **브라우저가 자동으로 열립니다**(http://localhost:5173). 끝에 LAN·Tailscale 접속 주소도 출력됩니다. **아무 때나 눌러도 안전**(중복 실행 안 함).

> - `GameGoal.exe` 첫 실행 시 Windows SmartScreen("Windows가 PC를 보호했습니다")이 뜨면 → **추가 정보 → 실행**(한 번만).
> - 직접 스크립트로 돌리려면: PowerShell에서 `cd D:\Claude\GameGoal; ./start-local.ps1`
> - 실행 정책 막히면 한 번만: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

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
> 다르면(예: 한쪽이 `192.168.55.x`) 공유기가 분리된 것 → 같은 WiFi에 붙이거나 아래 Tailscale 사용.

### 다른 네트워크일 때 — Tailscale (이미 설정됨)

두 기기가 **다른 공유기/대역**이라도 사설망으로 묶어 접속할 수 있다(외부에서도 가능).

1. 두 기기에 Tailscale 설치 + **같은 계정**으로 로그인 (이미 완료: 노트북·집 PC 모두 `longzzo@`)
2. 노트북의 Tailscale IP 확인 — PowerShell에서:
   ```powershell
   & "C:\Program Files\Tailscale\tailscale.exe" ip -4
   ```
   (현재 노트북 = `100.114.32.46`. 이 주소는 잘 안 바뀜)
3. 집 PC 브라우저에서 → **http://100.114.32.46:5173**

> Tailscale IP는 DHCP처럼 바뀌지 않아 북마크해도 됨. 단, **노트북의 3개 서버가 켜져 있어야** 보인다.

---

## 🔄 노트북을 껐다 켰을 때 — 집 PC에서 다시 접속하기

대부분 자동이라, **노트북에서 딱 하나(`GameGoal.exe` 더블클릭)만** 하면 됩니다.

### 부팅 시 자동으로 켜지는 것 (손댈 필요 없음)
- **Tailscale** — 자동 시작 · 자동 재연결. 노트북 주소 `100.114.32.46`은 **안 바뀜**.
- **Ollama** — 트레이 앱 자동 시작(모델은 D드라이브). _(자동이 아니면 `GameGoal.exe`가 알아서 켜줌)_

### 노트북에서 할 일
1. (선택) 트레이의 **Tailscale 아이콘이 연결됨(초록)** 인지 확인.
2. **`GameGoal.exe` 더블클릭** → 백엔드·프론트가 켜지고 브라우저가 열림 (10~20초).

> 순서 팁: Tailscale이 부팅 때 먼저 떠 있으므로, **로그인 후** `GameGoal.exe`를 누르면 프론트가 Tailscale 위에 정상 바인딩됩니다.

### 집 PC에서 할 일
1. 트레이 **Tailscale 아이콘 연결됨(초록)** 확인 (집 PC도 자동 재연결).
2. 즐겨찾기 → **http://100.114.32.46:5173**

### ✅ 체크리스트 (이게 다 되면 보임)
- [ ] 노트북: Tailscale 초록
- [ ] 노트북: `GameGoal.exe` 실행 → 노트북에서 http://localhost:5173 먼저 열림
- [ ] 집 PC: Tailscale 초록
- [ ] 집 PC: http://100.114.32.46:5173 접속

### 집 PC에서 안 열릴 때 (순서대로)
1. **노트북에서 먼저** http://localhost:5173 가 열리나? 안 열리면 → `GameGoal.exe` 다시 실행.
2. 양쪽 **Tailscale이 초록**인지 (둘 다 같은 계정 `longzzo@`).
3. 그래도 안 되면 노트북에서 **`GameGoal.exe`를 한 번 더 실행** (프론트를 Tailscale 연결 후 다시 바인딩 — 이게 가장 흔한 해결).
4. "현재 API를 호출할 수 없습니다"만 뜨면 AI(Ollama) 문제 → 아래 ⑥ 문제 해결 참고.

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
