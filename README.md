# 국장 통합 전략노트 - GitHub Pages + Gemini 관리자 업데이트형

## 구성

- `index.html` : 공개 메인 페이지
- `live.html` : 공개 오늘 브리핑 페이지
- `admin.html` : 관리자 전용 업데이트 페이지. 공개 메뉴에는 연결하지 않았습니다.
- `materials/` : 1~8번 자료 개별 페이지
- `worker/` : Cloudflare Worker 백엔드. Gemini API 키를 프론트엔드에 노출하지 않기 위해 필요합니다.

## 공개 방문자 권한

방문자는 자료 페이지와 `live.html`만 볼 수 있습니다. 방문자가 보는 공개 화면은 `/latest`에 저장된 결과만 읽습니다. Gemini API 호출은 `/admin/generate`에서만 실행되고, 이 엔드포인트는 `ADMIN_TOKEN`이 없으면 호출되지 않습니다.

## GitHub Pages 업로드

`samsung-live-pro-v2` 폴더 안의 파일을 `ADELIEBEAR/samsung` 저장소 루트에 업로드하세요.

```text
index.html
live.html
admin.html
config.js
materials/
assets/
data/
worker/
README.md
.nojekyll
```

GitHub Pages 설정:

```text
Settings → Pages → Deploy from a branch → main / root
```

## Cloudflare Worker 배포

1. Cloudflare에서 KV namespace 생성
2. `worker/wrangler.toml`의 `YOUR_KV_NAMESPACE_ID`를 실제 KV id로 교체
3. Worker Secret 등록

```bash
cd worker
npm install
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

4. 배포된 Worker URL을 루트의 `config.js`에 입력

```js
window.STRATEGY_NOTE_CONFIG = {
  API_BASE: "https://samsung-live-api.yourname.workers.dev"
};
```

## 관리자 사용법

브라우저에서 아래 주소로 접속합니다.

```text
https://adeliebear.github.io/samsung/admin.html
```

- Worker API URL 입력
- ADMIN_TOKEN 입력
- 오늘 시장 메모 입력
- `Gemini 분석 생성 + 공개 저장` 클릭
- 공개 사용자는 `live.html`에서 저장된 최신 브리핑만 봅니다.

## 보안 원칙

- Gemini API 키는 절대 `index.html`, `admin.html`, `config.js`에 넣지 않습니다.
- API 키는 Cloudflare Worker Secret `GEMINI_API_KEY`에만 저장합니다.
- 관리자 토큰도 Worker Secret `ADMIN_TOKEN`에만 저장합니다.
- 공개 사용자는 Gemini API를 호출할 수 없고 `/latest` 데이터만 읽습니다.
