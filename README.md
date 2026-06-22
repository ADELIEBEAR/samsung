# 국장 통합 전략노트

삼성전자 중심 사이트가 아니라, 한국 주식시장 전체 흐름과 섹터 로테이션을 보는 자료 사이트입니다.

## 구성

- `index.html`: 메인 화면, 실시간 티커, 오늘 브리핑 요약, 차트 대시보드, 자료실
- `live.html`: Gemini가 자동 생성한 오늘 시장 브리핑
- `admin.html`: 운영자용 설정 안내 (검색 노출 차단, 공개 메뉴에는 없음)
- `materials/`: 8개 자료 개별 페이지
- `data/today.json`: 자동 브리핑 결과 (Gemini)
- `data/charts.json`: 지수·대형주 차트 데이터 (Yahoo Finance)
- `.github/workflows/update-market.yml`: 브리핑 예약 업데이트
- `.github/workflows/update-charts.yml`: 차트 데이터 예약 업데이트
- `scripts/update-market.js`, `scripts/update-charts.js`: 각 업데이트 스크립트
- `worker/`: (선택) Cloudflare Worker 기반 수동 발행 API. 현재 프런트엔드에서는
  사용하지 않으며, GitHub Actions 자동화만으로 충분하면 삭제해도 됩니다.

## Gemini API 키 설정

API 키를 코드에 넣지 말고 GitHub Secret에만 넣으세요.

1. GitHub 저장소 → Settings
2. Secrets and variables → Actions
3. New repository secret
4. 이름: `GEMINI_API_KEY`
5. 값: Gemini API 키
6. Actions → Update Daily Market Briefing → Run workflow

## GitHub Pages

Settings → Pages → Deploy from a branch → `main` / root

## 주의

본 사이트는 투자 참고자료이며 특정 종목의 매수·매도 추천이나 수익 보장을 목적으로 하지 않습니다.
