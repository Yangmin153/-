# 여행길 — 대한민국 모바일 여행 동선 MVP

네이버 지도 기반의 모바일 우선 여행 동선 웹서비스입니다. GitHub 저장소에 통째로 업로드할 수 있으며, **FastAPI 서버 한 대에서 화면과 API를 함께 제공**합니다.

## 구현 완료

- 휴대폰용 반응형 UI: 검색용 하단 시트, 장소 추가/삭제, 체류시간 조절, 출발지·숙소 변경
- 네이버 지도 JavaScript SDK: 마커, 정보창, 경로 선, 지도 화면 전환
- **실시간 네이버 장소 검색**: NAVER API HUB **지역 검색**의 서버 측 프록시, 자동 검색, 원본 링크 표시, 결과 5건까지
- 날짜별 여행 일정: 출발지/숙소 반영, 거리 기반 분할 및 2-opt 휴리스틱, 이동·체류 시간표
- 네이버 Maps **Directions 5** API: 경로 **각 구간**의 도로 거리·소요 시간·선형 좌표 조회 (서버 키 필요)
- 길찾기 불가 시 직선거리 기반 추정치로 처리하고 결과에 **추정** 표시
- 일정 텍스트 복사, UI 조작, 오류 메시지, 보안상 API Secret 서버 관리

**실제 테스트 범위:** 서버 API/유효성 검사 및 브라우저 인터페이스. 네이버 라이브 검색/길찾기는 **사용자 개인 API 키가 없어 외부 호출을 검증하지 못했습니다**. 예상 시간·거리의 정확도도 실제 데이터 없이는 보증하지 않습니다.

## 매우 중요: 네이버 검색 API 사용 조건

2026년 9월 7일부터 강화된 [네이버 검색 API 약관](https://developers.naver.com/products/terms/)에 따르면, **검색결과의 독립적 표시, 출처·원본 링크 제공**, 결과의 **가공·저장 금지**와 API 목적 제한 등이 있습니다. 또한 네이버는 검색 API 결과의 저장이나 가공은 비상업적 용도라도 허용되지 않는다고 안내합니다.

이 프로젝트는 기술적 통합을 보여 주는 **개발용 MVP**입니다. 검색 결과를 동선 설계에 재사용하는 기능은 서비스의 핵심이지만 **네이버의 별도 명시적 이용 허용을 받기 전에는 이를 상업적·공개 서비스에 배포하지 마세요**. 결과를 저장하는 DB 기능은 제공하지 않습니다. 약관에 부합하는 대안 데이터 제공사나 별도 계약을 검토하세요. 지도 화면과 Directions 기능의 이용 약관도 별도로 확인해야 합니다.

- 네이버 약관: https://developers.naver.com/products/terms/
- 검색 데이터 저장·가공 FAQ: https://help.naver.com/service/30015/contents/17128
- NAVER API HUB 지역 검색: https://api.ncloud-docs.com/docs/naver-api-hub-search-local

## 1. 발급받을 키 (3종)

### A. 지도 SDK 공개 ID

네이버 클라우드 **Maps → Application**에서 Web Dynamic Map 이용을 활성화한 다음, 웹 서비스 URL에 실제 배포 주소(도메인)를 등록하세요.

`.env`의 `NAVER_MAP_CLIENT_ID=...` 입력. 이 ID만 **브라우저에 노출**됩니다. 서버 비밀키는 절대 JS에 넣지 마세요.

### B. 장소 검색 서버 키

**2026년 신규 검색 신청**은 네이버 개발자센터가 아닌 네이버 클라우드 **NAVER API HUB → Search API → 지역 검색**을 사용합니다. 네이버 개발자센터의 신규 신청은 2026-07-31 차단되었고 기존 검색 API는 2027-06-30까지 단계적으로 이관됩니다.

[NAVER API HUB 서비스 신청](https://console.ncloud.com/) 후 발급한 아래 두 값을 `.env`에 저장하세요.

```dotenv
NAVER_SEARCH_MODE=hub
NAVER_SEARCH_API_KEY_ID=발급받은_ID
NAVER_SEARCH_API_KEY=발급받은_비밀키
```

기존 개발자센터 발급키만 가진 경우 **일시적으로** `NAVER_SEARCH_MODE=legacy` 와 `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET`을 지원합니다. 새 서비스는 HUB를 권장합니다.

### C. 도로 경로 서버 키

네이버 클라우드 **Maps → Directions** 활성화. `.env`의 `NAVER_MAP_API_KEY_ID`, `NAVER_MAP_API_KEY` 입력. (지도 JavaScript의 `NAVER_MAP_CLIENT_ID`와는 설정 필드가 다릅니다.)

API 요청 `GET https://maps.apigw.ntruss.com/map-direction/v1/driving`로 각 구간의 경로를 가져옵니다. 서버 호출이므로 API Secret은 브라우저에 노출되지 않습니다.

## 2. GitHub Codespaces에서 실행 (PC방에서도 가능)

1. GitHub의 `korea-trip-route` 저장소에 이 ZIP **압축을 푼 모든 파일**을 업로드하세요. 기존 `index.html`은 이제 `web/index.html`로 이동합니다.
2. 저장소의 **Code → Codespaces → Create codespace on main** 클릭.
3. 터미널에서:

```bash
python -m pip install -r requirements.txt
cp .env.example .env
```

4. `.env`를 열어 자신의 API 키를 설정합니다. **절대 `.env`를 GitHub에 Commit하지 마세요.** `.gitignore`에 제외되어 있습니다. Codespaces 설정의 Secrets를 이용하면 더 안전합니다.
5. 실행:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

6. Ports 탭 → Port 8000 → **Open in Browser** 클릭.
7. `https://<codespace-url>/api/health`에서 검색·지도·길찾기 연결 설정 상태를 확인합니다.

> Codespaces 포트는 **Private** 설정을 유지하세요. 비밀키가 포함된 개발 서버를 공개하지 마세요.

## 3. 배포

### 간단 배포: Railway

- GitHub 저장소 연결 후 Dockerfile 감지하여 빌드합니다.
- **Variables**에 `.env.example`의 키를 등록합니다(실제 값 입력, `.env` 업로드 금지).
- Railway가 발급한 HTTPS 도메인을 네이버 클라우드 **Web 서비스 URL** 등록 목록에 추가합니다.
- 배포 후 `/api/health`에서 `search_configured`, `directions_configured`, `map_configured`가 `true`인지 점검합니다.
- Search API 약관상 허가받지 않은 결과의 가공/저장을 통한 **공개·상업 서비스 배포는 하지 마세요**.

### Google Cloud Run

- Dockerfile을 그대로 컨테이너로 빌드해 배포합니다.
- 비밀키는 **Secret Manager** 또는 서버 환경변수로 전달합니다. 만약 공개 배포하면 인증·요청량 제한·키 정책을 추가로 강화하세요.
- Cloud Run 주소를 네이버 지도 웹 도메인에 등록합니다.

**기존 GitHub Pages는 현재 백엔드 API를 실행할 수 없으므로 이 저장소의 서버 기반 검색·길찾기 기능은 Pages만으로 작동하지 않습니다.** 별도 API 호스팅 + CORS 설정을 추가할 수도 있지만 1개 서버 배포가 지금 단계에서는 편리합니다.

## 4. API

- `GET /api/config` 프론트엔드용 설정 상태 (비밀키 노출 없음)
- `GET /api/health` 서버 준비 상태
- `GET /api/search?q=제주%20성산일출봉` 장소 검색 원본 결과 (HUB 키 필요)
- `POST /api/plan` 일정 설계. `/api/docs` 에서 직접 테스트 가능

API 제한: 하루 최대 5일, 방문지 최대 15곳, 한 요청당 별도 Directions 2~20번 호출 가능. **유료 Maps 요청량** 및 동시 요청 제한에 유의하세요.

## 5. 현재 단계에서 하지 않는 것

- AI 장소 추천, 음식점 영업시간/휴무 정확도 판단, 대중교통 경로, 사용자 계정, DB 영구 저장, 여러 기기 간 동기화, 글로벌 최적 보장
- 실시간 교통을 모두 고려한 정확한 방문 순서 최적화 (순서는 위치 간 직선거리 기반 2-opt)
- 네이버 검색 결과를 허가 없이 DB에 축적하는 기능 (약관 제한)

## 6. 다음 개발 과제

1. NAVER 검색 데이터의 여행 일정 활용에 대한 **공식 승인 또는 사용 가능한 다른 POI 데이터 라이선스 확보**
2. 로그인/여행 일정 저장(DB)을 허가 범위 내에서 도입
3. 영업시간과 방문 일정 제약, 식사시간 설정
4. 경로 비용/시간 기반 최적화 행렬 및 캐시(지도 서비스 약관 준수)
5. 모바일 접근성, 로딩, 실패 복구, 공개 서비스 인증/Rate-limit, 운영 로그 고도화

## 테스트

```bash
python -m pip install pytest
pytest -q
node --check web/app.js
```
