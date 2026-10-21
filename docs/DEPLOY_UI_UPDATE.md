# 모바일 퍼스트 UI 업데이트 적용 절차

대상 저장소: https://github.com/Yangmin153/yeohaenggil
기준 커밋: `cc434f540b55214bd5edca625e14756fc8727afb`
대상 개발 브랜치: `feature/mobile-first-ui` (생성된 브랜치에 아직 파일 반영 전)

## GitHub Desktop (기존 파일 교체에 권장)
1. GitHub Desktop에서 해당 저장소를 clone하고 **Current branch**를 `feature/mobile-first-ui`로 전환합니다.
2. `yeohaenggil_mobile_first_changed_files.zip`을 **압축 해제한 내부 내용 전체**를 저장소 루트에 복사합니다. 기존 파일 덮어쓰기를 승인하되 `.env`나 키 파일은 복사하지 않습니다.
3. 변경 내역에 `public/index.html`, `public/static/app.js`, `public/static/styles.css`, `public/static/mobile-ux.js`, `public/static/trip-utils.js`, `tests/mobile-ux.test.js`, 아이콘 등만 변경됐는지 확인합니다.
4. 터미널에서 `npm test`로 20개 테스트 실행 후 Desktop에서 `feat: mobile-first UI and trip sharing`으로 커밋, **Push origin**을 누릅니다.
5. Vercel Preview 배포가 성공하면 네이버 지도 도메인 허용 목록(Preview URL)과 Preview 환경변수(네이버·카카오 API)를 확인합니다.
6. 모바일에서 일정/지도 탭, 카드 순서 이동, 검색·지도·최적화, 길안내, 공유 링크를 점검합니다.
7. GitHub에서 `feature/mobile-first-ui` → `main` Pull Request를 만들어 검토 후 Merge합니다.

## 설정 유의사항
- 환경변수는 GitHub에서 병합되지 않습니다. Vercel Preview/Production에 네이버 및 카카오 키를 별도 보유해야 합니다.
- 공유 링크는 개인 일정과 좌표가 포함됩니다. 공개된 링크는 누구나 열 수 있습니다.
- 네이버 지도 `nmap://`는 실제 설치된 네이버 지도 앱과 패키징된 WebView에서 반드시 실기기 테스트해야 합니다.
