이 폴더의 파일을 GitHub 저장소 루트에 같은 경로로 업로드하세요.

필수 경로:
.github/workflows/update-market.yml
scripts/update-market.js
data/today.json

그 다음:
1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. New repository secret
3. Name: GEMINI_API_KEY
4. Secret: 본인의 Gemini API 키
5. Actions 탭 → Update Daily Market Briefing → Run workflow
