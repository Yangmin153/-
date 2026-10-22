# 여행길 v4.9 — Supabase 연동 및 배포 체크리스트

## 코드와 저장 정책

- 바닐라 JS / Vercel Functions / Naver Maps / Kakao Places 유지
- 비회원은 기존 \`yeohaenggil.v2.days\` 브라우저 저장 유지
- 로그인 계정의 여행은 \`public.trips\`(Supabase PostgreSQL)에 저장하며 사용자별 RLS로 보호
- 클라우드 일정을 열더라도 비회원 로컬 원본은 덮어쓰지 않도록 클라이언트 저장을 분기함
- 클라우드 데이터 자동 저장이 아니라 **[여행 저장]** 클릭 후 서버 응답을 받아야 저장 완료로 표시
- \`supabase/migrations/20261022_user_trips.sql\`을 SQL Editor에서 적용해야 함
- 스키마: \`trips\` + \`days jsonb\`, 소유자·수정일 인덱스, 가져오기 중복 방지 인덱스, SELECT/INSERT/UPDATE/DELETE RLS
- JWT는 Supabase Auth에서 발급, Vercel Functions가 \`/auth/v1/user\`로 검증. 여행 소유자 ID는 요청 본문을 사용하지 않음
- RLS는 Supabase REST Data API에도 적용. \`service_role\` 키는 여행 CRUD 경로에서 전혀 사용하지 않음

## 연결 순서 (외부 Supabase 프로젝트 생성은 사용자가 직접 진행)

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 프로젝트 생성 (Region은 Korea와 가까운 지원 지역 선택)
2. **SQL Editor**에서 \`supabase/migrations/20261022_user_trips.sql\` 실행
3. **Authentication → Providers → Email**에서 이메일 로그인 및 이메일 인증 활성화
4. **Authentication → URL Configuration**에서 Production Site URL과 Redirect URLs 등록:
   - \`https://<production-domain>/**\`
   - \`https://<preview-domain>/**\` (실제 Preview URL과 브랜치 Preview alias 확인)
   - 이메일 확인/비밀번호 재설정 링크는 \`https://<도메인>/\`을 사용
5. **Project Settings / API Keys**에서 Project URL과 **publishable/anon key** 확인
6. **Vercel → 여행길 → Settings → Environment Variables**에서 Preview(필요시 Production)에 아래 값 추가:
   - \`SUPABASE_URL\`: https://PROJECT.supabase.co
   - \`SUPABASE_ANON_KEY\`: public publishable/anon API key (브라우저에 노출 가능한 공개 키)
   - \`SUPABASE_SERVICE_ROLE_KEY\`: **서버 전용** secret key (계정 삭제에만 사용, 반드시 Sensitive로 저장, 브라우저에 공개 금지)
7. 환경변수 저장 후 Vercel **Redeploy**. \`/api/config\`의 \`supabaseReady:true\` 확인. 공개 응답에 service role key가 없어야 함.
8. 서로 다른 이메일 사용자 A/B를 만들어 RLS 격리와 데이터 삭제 차단을 실제 두 계정으로 검증.
9. 운영 전 이메일 발송량 제한, SMTP 설정, Supabase Auth abuse protection/CAPTCHA와 Vercel WAF 및 요청량 제한, 개인정보처리방침과 탈퇴 안내를 준비.

**미설정 상태에서는 회원 시스템 사용 불가(서버 503)이며 비회원 작성/지도/검색/차량 동선 계산 기능은 유지됩니다.**

## RLS와 데이터 분리 테스트

- 사용자 A/B가 서로 다른 세션으로 로그인
- A가 여행 생성 → B 목록에서 A 데이터가 없어야 함
- B의 JWT로 A 여행 ID에 GET/PATCH/DELETE 호출 → 0 rows / 404
- 비로그인 상태에서 GET/POST → 401
- A가 다른 기기에서 동일 계정 로그인 → 목록 및 일정을 확인
- 계정 삭제는 \`SUPABASE_SERVICE_ROLE_KEY\` 등록 전까지 503이며, 등록 후 두 번의 확인(사용자 입력 DELETE)을 거쳐 실행
- 원본 브라우저 여행은 가져오기 성공 후에도 자동 삭제되지 않음
- 로그인 사용자의 클라우드 여행은 로컬 저장 키에 다시 기록하지 않음
- 회원가입 이메일 중복 처리는 Supabase Auth의 일반화된 응답 정책을 따름

## 데이터 모델 및 제한

- 사용자 식별자는 \`auth.users.id\` UUID
- 여행당 날짜 1~10개, 날짜당 방문지 최대 30개, JSONB 최대 100KB
- 여행 제목 1~90자, 지역 80자
- 이동시간 최적화 결과는 재계산 가능한 캐시이므로 JSON 저장에서 제거
- 초기 데이터 모델은 JSONB, 향후 공유/검색 기능 확장 시 별도 stops/legs 정규화 검토
- 동일 여행 동시 수정 시 **마지막 저장 우선**. 편집 충돌 병합 및 오프라인 큐는 미구현.

## 운영상 남은 검증과 제약

- 실제 Supabase 프로젝트와 이메일 발송은 이 커밋에서 만들거나 활성화하지 않음
- 테스트는 모의 인증/REST API와 코드 검증이며 실제 RLS SQL 실행 결과가 아님
- 단순 회원가입만으로 Google/Kakao/Naver OAuth 로그인은 제공되지 않음
- 비밀번호 초기화 링크와 계정 삭제는 연결 후 실제 이메일/실계정 테스트 필요
- 320/375/390/430/768/1440 실제 화면·iPhone Safari 및 Android Chrome 키보드 리사이즈는 별도 실기기 확인
- 서버 함수는 Bearer 토큰과 출처 검증을 수행하지만 운영규모 성장 전 네트워크 레이트리밋/모니터링 권장

## CSS 구성

기존 활성 스타일 8개(기본/폴리시/지도/Quick-Add/버전별 덮어쓰기)를 페이지에서 개별 로드하지 않고 아래 **2개 진입점**으로 묶었습니다.

- \`public/static/foundation-v49.css\`: 공통 타이포그래피, 기존 PC/지도 컴포넌트의 기본 스타일
- \`public/static/mobile-v49.css\`: 모바일 검색·일정·지도·계정 화면 및 반응형 스타일

기존 CSS 원본 파일은 회귀 참고 및 복원용으로 저장소에 남겼으나 HTML에서 로딩하지 않습니다. **중복 선언 및 \`!important\` 전수 제거는 회귀 위험으로 아직 완료되지 않았고**, 이 단계는 기능을 보존하는 스타일 엔트리 통합에 집중했습니다. 모든 UI의 전후 실기기 비교도 아직 수행하지 않았습니다.

