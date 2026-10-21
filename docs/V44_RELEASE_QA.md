# 여행길 4.4 — 배포 및 QA 기록

## 실제 소스 및 보존 범위
- GitHub 기준: `Yangmin153/yeohaenggil`, `feature/map-workspace-v43` / `96b7ba83ff58290e039bcbb205fece8d922dbee4`.
- 구현: Vercel Node.js Functions + 브라우저 바닐라 JavaScript. 현 저장소는 FastAPI가 아님. Vercel 프로젝트 메타데이터에 Framework `fastapi` 설정이 남아 있으므로, 운영 설정 변경 전 현재 정상 서비스 동작을 먼저 확인할 것.
- 기존 네이버 경로 계산, 카카오 장소 통합 검색, 날짜별 출발지·도착지, 수동 순서 및 카테고리 유지. 시간 산정에서 체류시간을 제거하며 로컬 데이터의 과거 `stayMinutes`는 로딩할 때 제거함.

## 변경 기능 및 알려진 제약
- 30곳/일, 최대 10일 데이터 구조 유지. 자동 최적화에서 `locked`는 해당 index를 보존하며 다른 장소만 재배열.
- 지도 시트가 실제 지도 요소 내부로 들어왔음. fitBounds에 시트의 지도 중첩 높이만큼 동적 bottom padding 적용. 현재 날짜의 실제 경로 `leg.path`도 범위 계산에 포함.
- 지도 이탈 시 복귀 버튼, 카테고리 원탭 순환 및 오른쪽 Pin 버튼.
- 경유 추천: 카카오 로컬 키워드 근처 검색. 도로 위 장소라는 보장이 **없으므로** '가는 길'은 주변 후보라는 주의문구를 표시. 경유 추가는 수동 순서로 전환하고 계산 결과를 무효화.
- 검색: debounce 520 → 260ms, 이전 AbortController 취소, 요청별 경쟁 상태 방지, 25초·24개 한정 메모리 캐시. 외부 API 쿼터/이용조건 확인 후 운영 필요.
- PNG 내보내기: **실제 네이버 Directions의 `leg.path` 좌표가 포함된 1200×900 경로 도식**을 생성. 날짜/전체 옵션 제공. **NAVER 지도 배경은 포함하지 않음**. 지도 배경의 저장/재배포 권한이 확인되지 않아 Static Map 취득 또는 타일 합성 기능을 사용하지 않음. 이미지 기능의 정식 요건 일부 미충족 상태.

## 실행한 검증
- `npm test`: 36 통과, 0 실패 (2026-10-21).
- `node --check`: 변경된 JS 및 server modules 문법 확인.
- Chromium DOM 조작 테스트 (네트워크 없는 HTML/CSS/JS 삽입): 360/390/430/768/1440px에서 카드 펼침 접기 22회, 첫 카드 높이 64/65px로 복귀, 가로 넘침 0px, JS 오류 0건. 이는 실서비스 E2E가 아님.
- 브라우저 주입형 모의 API 테스트: 1/5/15/30개 카드 동작, 핀/카테고리 수정, 동일 검색 재요청 1회→1회 유지.
- 상세 패널 스크린샷에서 기존 버튼이 가로폭 부족으로 세로로 깨지는 추가 문제 발견 후 CSS 버튼 최소 너비/줄바꿈 규칙을 변경하고 후속 스크린샷에서 정상 배치 확인.
- 지도 시트가 지도 위로 펼쳐질 때 하단 padding 값 변화 실측: 닫힘 95px, 펼침 334px(390px 테스트 창).
- Chromium PNG 생성: 일차별과 전체 일정 모두 1200×900 PNG 파일 생성 및 Pillow 이미지 크기 확인. 가상 경로 데이터 검증, 실 네이버 API + 지도 타일 검증이 아님.
- Vercel 프로젝트: 기존 v4.3 Preview 배포 READY, `feature/map-workspace-v43` SHA `96b7ba83` 확인. 새 v4.4 코드 Vercel 배포는 미실행.

## 아직 검증·처리가 필요한 사항
- 실제 네이버 Maps SDK의 fitBounds/제스처/마커 클릭과 스크롤 시트 충돌.
- Vercel Preview에서 등록된 지도 Web 서비스 URL 및 실제 Kakao/Naver 키로 외부 API 응답 확인.
- 네이버 Static Map 이미지 저장·가공 권한을 서비스 이용약관/계약으로 확인하여 필요한 경우 별도 서버 기능 구현.
- Playwright 사이트 직접 접근: 이 실행환경의 Chromium이 `net::ERR_BLOCKED_BY_ADMINISTRATOR`로 로컬 웹 접속을 막음. Vercel 프로젝트 조회 결과 패스워드/SSO/Trusted IP 보호는 모두 disabled. 현재 도구의 사이트 접속 실패를 Vercel 보안 설정 탓으로 단정하지 않음.
- `feature/route-ux-performance-v44` GitHub 브랜치는 생성만 되어 있음. 파일은 아직 Push하지 않았으며 PR/Production 병합도 수행하지 않음.

## 사용자 배포 절차
1. ZIP 압축을 해제하여 GitHub Desktop에서 `feature/route-ux-performance-v44` 브랜치의 저장소 최상위에 복사합니다. ZIP 파일 자체를 GitHub에 올리지 마세요.
2. `npm test`를 실행해 36개 테스트가 통과하는지 확인합니다.
3. Desktop에서 변경 파일만 Commit → Push origin.
4. Vercel Deployments에서 위 브랜치 Preview `Ready`가 되었는지 확인합니다.
5. 휴대폰으로 검색, 지도, 경로, 핀·카테고리, PNG 내보내기 및 20회 카드 펼침/접힘을 실기기 테스트합니다.
6. 모든 검증이 끝나기 전 `main`으로 병합하지 않습니다.

## Vercel 자동화 접근
- Vercel 연결계정 프로젝트 조회에서 `passwordProtection.enabled=false`, `ssoProtection.enabled=false`, `trustedIps.enabled=false`로 확인됨. 실제 Preview 요청의 WAF/봇 보호는 별도 조사 필요.
- 승인된 자동화 도구가 보호된 Preview를 테스트하려면 `Settings → Deployment Protection → Protection Bypass for Automation`의 전용 비밀키를 GitHub Actions/Playwright 비밀변수에 저장하고 `x-vercel-protection-bypass` 헤더를 전송합니다. 비밀키를 앱 코드·클라이언트·URL에 노출하지 않습니다.
- 현재 repo `api/route.js`, `api/places.js`, `api/recommendations.js`는 별도 앱 인증 없이 인터넷에서 호출 가능하므로 Vercel Firewall, API 사용량/비용 모니터링 설정을 권장합니다.
