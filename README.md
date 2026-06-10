# 국장 통합 레짐노트

삼성전자 중심 사이트가 아니라, 한국 주식시장 전체 레짐과 섹터 로테이션을 보는 자료 사이트입니다.

## 구성

- `index.html`: 메인 화면, 오늘 브리핑 요약, TradingView 차트, 자료실
- `live.html`: Gemini가 자동 생성한 오늘 시장 브리핑
- `materials/`: 8개 자료 개별 페이지
- `data/today.json`: 자동 브리핑 결과
- `.github/workflows/update-market.yml`: 예약 업데이트
- `scripts/update-market.js`: Gemini API 호출 스크립트

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
