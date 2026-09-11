# 프롬프트 통역소

하나의 아이디어를 Midjourney, ChatGPT, Suno 등 생성형 AI마다 다른 프롬프트 문법에 맞게 변환해주는 웹앱입니다. 프롬프트 생성은 Google Gemini API가 담당하며, API 키는 서버(Vercel Serverless Function)에만 저장되어 브라우저로 노출되지 않습니다.

## 구조

- `index.html` — 정적 프론트엔드
- `api/generate.js` — Gemini API를 호출하는 Vercel 서버리스 함수 (`/api/generate`)

## 1. Gemini API 키 발급 (무료)

1. https://aistudio.google.com/apikey 접속 후 Google 계정으로 로그인
2. "Create API key" 클릭 → 키 복사
3. 무료 등급에는 분당/일별 요청 한도가 있습니다. 이 키는 배포 후 **방문자 전체가 공유**하게 되므로, 사용량이 많아지면 한도에 걸릴 수 있어요. 필요하면 [AI Studio 대시보드](https://aistudio.google.com/)에서 사용량을 주기적으로 확인하세요.

## 2. GitHub에 올리기

```bash
git init
git add .
git commit -m "prompt interpreter web app"
git branch -M main
git remote add origin <본인 GitHub 저장소 URL>
git push -u origin main
```

## 3. Vercel에 배포

1. https://vercel.com 가입/로그인 → "Add New" → "Project"
2. 방금 올린 GitHub 저장소 선택 → Import
3. **Environment Variables**에 아래 값 추가:
   - `GEMINI_API_KEY` = 1단계에서 발급받은 키
   - (선택) `GEMINI_MODEL` = 사용할 모델명 (기본값 `gemini-3.6-flash`)
4. "Deploy" 클릭 → 완료되면 `https://<프로젝트명>.vercel.app` 주소로 접속 가능

빌드 설정은 따로 건드릴 필요 없습니다. Vercel이 `index.html`은 정적 파일로, `api/generate.js`는 서버리스 함수로 자동 인식합니다.

## 로컬에서 테스트하기

Vercel CLI로 `api/` 폴더의 서버리스 함수까지 포함해 로컬 실행할 수 있습니다.

```bash
npm install -g vercel
vercel dev
```

`.env.example`을 `.env`로 복사하고 `GEMINI_API_KEY`를 채워넣은 뒤 실행하세요.

## Netlify에 배포하려면

`api/generate.js`를 `netlify/functions/generate.js`로 옮기고, 함수 시그니처를 Netlify 방식(`exports.handler = async (event) => {...}`)으로 바꿔야 합니다. 프론트엔드의 `fetch('/api/generate', ...)` 호출도 `/.netlify/functions/generate`로 바꾸거나 `netlify.toml`에 리다이렉트 규칙을 추가해야 합니다.

## 알아두면 좋은 점

- API 키를 공유하는 구조라 방문자가 몰리면 무료 할당량을 빠르게 소진할 수 있습니다. 트래픽이 늘어나면 AI Studio에서 유료 등급으로 전환하거나, 방문자별 요청 제한(rate limiting)을 추가하는 것을 고려하세요.
- `api/generate.js`는 입력 길이와 선택 가능한 플랫폼 수를 제한해두었지만, 별도의 로그인/인증은 없습니다. 공개적으로 널리 공유할 계획이라면 악용 방지 장치(예: 간단한 캡차, IP 기반 rate limit)를 추가로 고려하세요.
