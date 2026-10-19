# 여행길 v4 — GitHub + Vercel 배포판

네이버 지도와 도로 길찾기를 사용하여 **출발지 → 관광지 전체 → 최종 도착지** 순서의 자동차 여행 동선을 계산하는 웹사이트입니다. **Cloudflare 및 Google Cloud Run을 사용하지 않습니다.** GitHub에는 코드가 있고, Vercel은 정적 화면과 서버 측 API를 제공합니다.

> 검증 범위: Node.js 자동 테스트 9건, 로컬 HTTP 요청으로 화면(200), CSS(200), 건강 체크, 환경 설정, 최적화 API 동작을 확인했습니다. **실제 Vercel 클라우드 배포, 개인 네이버 인증키를 이용한 실 API 호출, 모바일 실기기 드래그는 테스트하지 못했습니다.**

## 1. 5분 배포: 초보자 순서

**1) ZIP 압축을 해제하세요.** 이 `README.md`, `vercel.json`, `package.json`, `api/`, `lib/`, `public/` 폴더를 포함한 파일들이 나옵니다.

**2) GitHub에 저장소를 만드세요.** [github.com/new](https://github.com/new)에서 `yeohaenggil`과 같은 Repository name을 입력하고 **Create repository**를 누릅니다. 기존 여행 사이트 저장소를 사용한다면 기존 코드와 파일 경로가 겹칠 수 있으므로 **새 브랜치에서 먼저 검토**하세요.

**3) GitHub 파일을 업로드하세요.** 새 저장소의 **Add file → Upload files**를 선택합니다. **ZIP 자체를 올리지 말고 압축을 푼 파일/폴더**를 업로드합니다. 최상위에 `vercel.json`, `package.json`, `api`, `lib`, `public`이 있어야 합니다. `Commit changes`를 누릅니다. 폴더 전체 업로드가 어렵다면 Windows 탐색기에서 파일/폴더를 GitHub 업로드 영역으로 끌어놓습니다. **`.env`는 업로드 금지입니다.**

**4) [Vercel 대시보드](https://vercel.com/new)에서 Add New → Project를 엽니다.** GitHub 저장소를 연결하고 `yeohaenggil` 저장소를 Import합니다.

**5) 프로젝트 빌드 환경을 확인합니다.**

| 항목 | 설정 |
|---|---|
| Framework Preset | **Other** |
| Root Directory | `./` (파일을 최상위에 올린 경우) |
| Build Command | **비워두기 / 사용 안 함** |
| Output Directory | `public` (`vercel.json`에도 설정됨) |
| Install Command | 기본값 |

**6) 배포를 누릅니다.** 네이버 API 키가 없어도 예시 관광지와 추정 거리 기반 경로 최적화 화면은 테스트할 수 있습니다. 배포 URL 예시는 `https://yeohaenggil-xxxx.vercel.app` 형태이며 실제 주소는 Vercel이 생성합니다.

**7) 기존 네이버 키를 연결합니다.** Vercel → 프로젝트 → **Settings → Environment Variables**에 다음 항목을 추가합니다. Production을 선택하고 Preview에서도 쓰려면 Preview도 지정합니다. 키 추가 후 **Redeploy** 해야 기존 배포에 적용됩니다.

| 변수 이름 | 값 | 공개 여부 |
|---|---|---|
| `NAVER_MAPS_CLIENT_ID` | 네이버 Maps API Client ID | 지도용 공개 ID로 표시될 수 있음 |
| `NAVER_MAPS_CLIENT_SECRET` | 네이버 Maps API Client Secret | **서버 전용 비밀키** |
| `NAVER_MAPS_JS_KEY_ID` | 지도 JS 인증에 별도 ID를 쓸 경우만 지정 | 브라우저에 공개되는 ID |
| `MAX_EXACT_STOPS` | `4` 추천. 최대 `6` | 일반 설정값 |

네이버 클라우드 콘솔에서도 **Web Dynamic Map, Directions 5, Geocoding** 활성화 여부와 **Vercel 서비스 URL의 웹 인증 등록**을 확인해야 합니다. Vercel의 미리보기 주소와 최종 도메인이 다르면 해당 주소도 네이버 콘솔에서 허용되어야 합니다.

**8) 동작 확인 순서**

- `https://배포주소/api/health` → `"ok":true`
- `https://배포주소/api/config` → `"directionsReady":true` : **키 존재만 확인** (네이버 실제 인증 성공 의미는 아님)
- 웹사이트 접속 → 네이버 지도 표시 확인
- 예시 관광지 2~4곳 선택 → **최적 동선 계산하기**
- 방문 결과가 **도로시간 최적화**이면 네이버 도로 응답을 모두 받아 계산한 것
- **추정 구간 포함** 등으로 표시되면 일부 또는 모든 이동이 추정치임

## 2. 동선 최적화 정확도

- 방문지 0~4곳(기본), 자동 최적화: 방문지의 가능한 순서들을 비교합니다. 네이버 Directions 5 호출 결과로 **각 방향의 도로 이동시간을 확보한 경우** 그 고정 시간표에서 최소 이동시간인 순서를 계산합니다. 출발지·도착지, 관광지 순서 고정 기능 포함.
- `MAX_EXACT_STOPS=6`으로 올리면 최대 6곳까지 도로시간 전수 비교할 수 있지만 최대 **42번**의 네이버 유료 호출이 발생할 수 있습니다(0~4곳도 최대 20번). 사이트 트래픽에 따라 과금이 커질 수 있습니다.
- 방문지 5~12곳(기본값 기준): 직선거리 기반 최근접 선택 + 2-opt 근사 방문 순서를 만들고, 실제 선택된 구간을 네이버 자동차 경로로 조회합니다. **도로시간 기준 전역 최적을 보장하지 않습니다.**
- **내 순서 유지** 모드: 관광지의 순서를 변경하지 않고 선택된 구간만 길찾기합니다.
- 네이버 API가 없거나 실패했을 때는 거리 보정으로 계산한 **추정치**를 표시합니다. 도로 경로인 것처럼 표시하지 않습니다.
- **실시간 교통 변화**, 예약·관광지 영업시간, 휴무일, 날씨, 주차장 실제 입구 등은 **현재 최적화 제약 조건에 포함되지 않습니다.** `travel-date`를 입력해도 미래 시점의 도로 교통량 예측은 하지 않습니다.

## 3. 화면에 있는 기능

날짜별 출발지·최종 도착지 별도 설정, 전날 도착지 자동 인계(필요하면 수정), 방문지 추가·삭제·수정·체류시간, 관광지의 다른 날짜 이동, 순서 고정, PC/모바일 Pointer Events 기반 드래그, 이동 ↑↓ 버튼, 수동·자동 모드 전환, JSON 백업·복원, 브라우저 자동 저장, 이동시간·거리·관광지 체류시간·도착시간, 네이버 지도 경로 표시, 최적화 절감 시간(정확한 비교 가능 시), 주소 지오코딩, 지도 클릭으로 위치 선택, 예시 관광지 선택 등이 포함됩니다.

**네이버 일반 검색 API를 통한 관광지 이름 검색은 미포함**입니다. 주소 검색(Geocoding) 또는 지도 클릭으로 좌표를 정한 다음 관광지 이름을 입력할 수 있습니다. 네이버 검색 결과의 저장·가공 및 목적외 사용 가능 여부는 별도 약관 검토가 필요합니다.

## 4. 공개 사이트로 운영하기 전 보안·요금 관리

- 네이버 비밀키는 **GitHub/HTML/브라우저 JS에 절대 입력하지 마세요.** Vercel 환경변수에만 넣으세요.
- API 서버는 공개 주소를 갖습니다. 단순한 입력 검증만으로는 **API 남용 방지 기능이 완성되지 않습니다.** Vercel Firewall/Rate Limiting, 배포 접근 제한, 사용량 한도, 네이버 API 비용 알림을 설정해야 합니다.
- 공개 시 무료 플랜 제한 및 상업용 사용 가능 범위를 Vercel 약관과 이용 중인 네이버 Maps 상품에서 확인하세요.
- 현재 일정 저장은 **브라우저 로컬**입니다. 다른 기기에서 동기화되지 않으며 브라우저 데이터를 지우면 복구되지 않습니다. JSON 백업을 추천합니다.
- 실시간 네이버 Maps API 응답을 무제한 저장하는 캐시는 두지 않았습니다. 도로 경로 데이터의 저장·재이용은 네이버 지도 관련 약관에서 허용 범위를 확인하세요.

## 5. 로컬 실행·테스트 (선택)

Node.js 20 이상 설치 후 프로젝트 폴더에서:

```bash
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`에 접속합니다. 네이버 API를 연결하려면 `.env.example`을 복사하여 `.env`로 바꾼 후 실제 키를 입력합니다. `.env`는 `.gitignore`에 포함되어 있습니다.

자동 테스트:

```bash
npm test
```

## 6. 프로젝트 파일 구성

```text
yeohaenggil-github-vercel/
├─ public/
│  ├─ index.html            # 반응형 메인 화면
│  └─ static/
│     ├─ app.js             # 일정 관리, 순서 변경, 네이버 지도 연동
│     └─ styles.css         # PC/휴대폰 디자인
├─ api/
│  ├─ health.js             # 배포 상태 확인
│  ├─ config.js             # 지도 ID 공개 설정 (비밀키 제외)
│  ├─ geocode.js            # 네이버 주소→좌표 검색
│  └─ route.js              # 여행 최적화 요청
├─ lib/core.js              # 경로 최적화, Naver API 서버 연결
├─ tests/vercel.test.js     # 9개 자동 테스트
├─ vercel.json              # Vercel 프로젝트 설정
├─ package.json             # Node 버전/테스트/로컬 실행
├─ dev-server.js            # 로컬 개발만 사용
├─ .env.example             # 변수 이름 예시 (실제 키 아님)
├─ .gitignore
└─ README.md
```

## 7. 공식 참고 문서

- Vercel에서 GitHub 연결: https://vercel.com/docs/git/vercel-for-github
- Vercel Node.js Functions: https://vercel.com/docs/functions/runtimes/node-js
- Vercel 정적 사이트 배포: https://vercel.com/docs/builds/configure-a-build
- Vercel 환경변수: https://vercel.com/docs/environment-variables
- 네이버 Directions 5: https://guide.ncloud-docs.com/docs/en/maps-direction5-api

**기존 사용 중인 GitHub 프로젝트에 적용할 경우** 기존 파일을 백업하고, 별도 브랜치에서 검증한 후 병합하세요. 이 파일은 Cloudflare판을 Vercel로 변환한 독립 GitHub 배포용 프로젝트입니다.
