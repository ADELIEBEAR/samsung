# Cloudflare Worker for Samsung Strategy Note

이 Worker는 Gemini API 키를 프론트엔드에 노출하지 않기 위한 백엔드입니다.

## Secret

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ADMIN_TOKEN
```

## Endpoints

- `GET /latest` : 공개 브리핑 읽기. 방문자용. Gemini 호출 없음.
- `POST /admin/generate` : 관리자만. Gemini 호출 후 KV에 저장.
- `POST /admin/publish` : 관리자만. JSON을 직접 KV에 저장.
- `GET /health` : 상태 확인.

## KV

`LIVE_DATA` binding이 필요합니다. `wrangler.toml`의 KV id를 교체하세요.
