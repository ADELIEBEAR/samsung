# 국장 통합 전략노트

삼성전자 중심 사이트가 아니라, 한국 주식시장 전체 흐름과 섹터 로테이션을 보는 자료 사이트입니다.

## 구성

- `index.html`: 메인 화면. 자료실 8편이 최상단에 오고, 그 아래 오늘 브리핑 요약·섹터맵·연결 자료실
- `live.html`: 검색 근거·출처 검사를 통과한 자동 뉴스 요약. 검사 실패 시 요약을 숨깁니다.
- `admin.html`: 운영자용 설정 안내 (검색 노출 차단, 공개 메뉴에는 없음)
- `materials/`: 8개 자료 개별 페이지
- `data/today.json`: 자동 브리핑 결과 (Gemini)
- `.github/workflows/update-market.yml`: 브리핑 예약 업데이트
- `scripts/update-market.js`: 업데이트 스크립트
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

## 배포

현재 운영 사이트는 Netlify의 `main` 브랜치 연동으로 배포됩니다. GitHub Pages를 별도로 사용할 때는 Settings → Pages → Deploy from a branch → `main` / root를 선택합니다.

## 자동 발행 안전장치

- 모델이 쓴 출처 배열을 사용하지 않습니다. Google 검색의 grounding metadata에 연결된 문장만 허용하며 문장 전체, 범위, part, 출처 인덱스를 검사합니다.
- 출처는 `assets/js/briefing-safety.js`의 명시된 언론사·공공기관 도메인의 HTTPS 기사 URL만 허용합니다. 리디렉션도 매 단계 검사하고 최종 응답이 HTTP 200 HTML인지 확인합니다. 차단·오류·불충분한 출처는 발행 보류로 처리합니다.
- 요약 문장에는 한국 시간 오늘 또는 어제 날짜를 명시해야 합니다. 투자 행동을 권하는 표현과 과거 보유자·신규 진입자 대응, 시장 온도·위험 등급은 자동 발행하지 않습니다.
- 이 검사는 독립적인 사실 확인이나 기사 발행일 인증이 아닙니다. 검색 엔진의 근거 연결이 틀릴 수도 있으므로 화면에서도 자동 요약임을 알리고 원문과 날짜 확인을 안내합니다.
- 실패하면 이전 내용을 최신 내용처럼 유지하지 않고 `status: unavailable`을 저장합니다. 레거시 형식·잘못된 URL·만료된 요약은 메인 화면과 상세 화면 모두 숨깁니다. 정상 요약도 생성 후 최대 18시간만 표시합니다.
- 가격 조회 실패 시 가상 가격이나 임의 시각을 생성하지 않습니다. 실제 제공자 관측 시각과 조회 시각을 구분하며, 휴장일을 고려해 7일보다 오래된 가격은 보류합니다. 실시간 시세가 아닙니다.
- 두 데이터 워크플로는 같은 동시 실행 그룹을 사용합니다. 다른 변경은 rebase 후 보존하며 동일 파일 충돌 시 강제로 덮어쓰지 않고 실패합니다.
- 루트 `update-market.js`는 검증된 `scripts/update-market.js`의 호환 진입점입니다. 현재 화면에서는 선택적 `worker/` API를 사용하지 않습니다.

## 테스트

Node.js 24에서 `node --test tests/*.test.js`와 `bash -n scripts/commit-data.sh`를 실행합니다. 테스트는 API 키나 외부 네트워크를 사용하지 않습니다. 생성 실패, 가상 출처, 범위·날짜·URL 검사, 화면의 실패 처리, 가격 데이터, 로컬 Git 충돌 보존을 검사합니다. 예약 실행도 테스트를 먼저 통과해야 데이터를 생성합니다.

## 주의

본 사이트는 투자 참고자료이며 특정 종목의 매수·매도 추천이나 수익 보장을 목적으로 하지 않습니다.

