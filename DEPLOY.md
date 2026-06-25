# 배포 가이드 — 프론트(GitHub Pages) + 백엔드(Render)

이 앱은 **프론트엔드(정적 SPA)** 와 **백엔드(FastAPI/Python)** 로 나뉩니다.
GitHub Pages는 정적 파일만 호스팅하므로, 백엔드는 별도의 Python 호스트(여기서는 **Render** 무료 플랜)에 올립니다.

> ⚠️ 모든 기능(시뮬레이션 계산 포함)이 백엔드를 호출합니다. **백엔드를 먼저 띄워야** 프론트가 동작합니다.
> 백엔드가 없으면 모든 모듈이 "현재 API를 호출할 수 없습니다"로 표시됩니다.

---

## 0) GitHub에 코드 올리기

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

> `backend/.env`(토큰)는 `.gitignore`로 제외됩니다. 푸시 전 `git status`에 `.env`가 없는지 꼭 확인하세요.

---

## 1) 백엔드 배포 (Render)

1. https://render.com 가입(GitHub 연동) → **New ▸ Blueprint** → 이 리포 선택.
2. 리포 루트의 [`render.yaml`](render.yaml)을 자동 인식합니다. **Apply**.
3. 서비스의 **Environment**에서 값 입력:
   - `GITHUB_MODELS_TOKEN` = 본인 GitHub PAT(models 권한)
   - `ALLOWED_ORIGINS` = `https://<USER>.github.io` (프론트 주소; 1단계 배포 후 정확히)
   - `LLM_REASONING_EFFORT` = `low` (이미 기본값)
4. 배포 완료 후 백엔드 주소를 복사: 예 `https://gamegoal-backend.onrender.com`
   - `/api/v1/meta` 를 열어 `{"llm_enabled":true,...}` 확인.

> 무료 플랜은 유휴 시 슬립합니다 → 첫 요청에 ~50초 콜드스타트(+gpt-5 지연). 데모용으로는 충분.

---

## 2) 프론트엔드 배포 (GitHub Pages)

1. 리포 **Settings ▸ Pages ▸ Build and deployment ▸ Source = GitHub Actions**.
2. 리포 **Settings ▸ Secrets and variables ▸ Actions ▸ Variables ▸ New variable**:
   - `BACKEND_URL` = 1단계의 백엔드 주소(예 `https://gamegoal-backend.onrender.com`)
3. `main`에 푸시하면 [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)이 자동 빌드/배포합니다.
   - (수동 실행: **Actions ▸ Deploy frontend to GitHub Pages ▸ Run workflow**)
4. 완료 후 주소: `https://<USER>.github.io/<REPO>/`

> `BACKEND_URL`을 나중에 바꾸면 워크플로우를 **다시 실행**해야 반영됩니다(빌드 시점에 주입되기 때문).

---

## 동작 방식 요약
- 로컬 개발: 프론트가 `/api`를 Vite 프록시로 `127.0.0.1:8000`에 전달.
- 배포: 빌드 시 `VITE_API_BASE_URL`(=`BACKEND_URL`)을 주입 → 프론트가 Render 백엔드를 직접 호출.
- 백엔드 `ALLOWED_ORIGINS`에 Pages 주소가 있어야 CORS 통과.
- 토큰은 **Render 서버에만** 존재하고 프론트 번들에는 포함되지 않습니다.
