---
type: adr
status: accepted
scope: dfragon.com web client, apps/api score and portrait boundary, apps/desktop shared search core
decided: 2026-11-01
last-reviewed: 2026-11-01
superseded-by: 없음
evidence: "Issue #1074 정한 것, 구조, 확인한 사실(https://github.com/dungeon-and-dragon/dfragon/issues/1074) ; 저장소 소유자 결정(2026-11-01) ; 네오플 초상화와 운영 API 응답의 CORS 헤더 확인(2026-11-01) ; Issue #1076 화면 공유 실기 확인(2026-11-01, Windows 10, Chrome, Edge, https://github.com/dungeon-and-dragon/dfragon/issues/1076#issuecomment-6553122671)"
review-after: 모바일 client, 웹에서 화면 이미지를 서버로 보내는 기능, 별도 workspace package 도입 전
---

# ADR 0004: dfragon.com 첫 화면에 설치 없이 쓰는 웹 클라이언트를 둔다

## 상태

채택. 웹 클라이언트 계약은 [웹 클라이언트](../rules/web-client.md), 점수 엔진과 앱 경계는 [Architecture Overview](../architecture/overview.md), Desktop 안의 공용 폴더는 [Desktop 코드 구조](../architecture/desktop-code-organization.md)에 둔다. 구현은 [Issue #1074](https://github.com/dungeon-and-dragon/dfragon/issues/1074)의 sub-issue로 나눠 진행한다.

## 맥락

설치 단계에서 대부분의 사용자가 빠졌다.

- 커뮤니티 홍보 글의 조회는 약 5천이었는데 포터블 exe 다운로드는 5건(지인 제외 3건), 실행은 1건이었다.
- 실행한 사용자는 2~3시간 동안 캐릭터 API를 약 900번 불렀다. 쓰기 시작하면 계속 쓰는 도구다.
- 서명 없는 exe에 대한 불신과 450MB 용량은 둘 다 받기 전에 판단하는 장벽이다. 450MB는 포터블 exe가 실행마다 압축을 풀기 때문에 압축을 끈(`compression: 'store'`) 결과이고, 압축하면 약 163MB이며 대부분 Electron, Chromium이다.
- 지금 문서는 클라이언트를 Desktop 하나로 보고 경계를 정했다. 점수 엔진은 Desktop main만 로드하고, API는 이미지를 중계하지 않으며, 웹사이트는 Desktop의 창 목업 entry만 import한다.

## 확인한 사실

- Renderer는 Electron을 직접 참조하지 않고 `preload/index.d.ts`의 bridge 9개(`api`, `search`, `raidSearch`, `desktopShortcut`, `desktopClipboard`, `todayGrade`, `diagnostics`, `updateNotice`, `windowChrome`)로만 main에 닿는다.
- 파티는 renderer가 프레임 전체(`{ width, height, rgba }`)를 받아 crop한다. 공대는 main이 12행 닉네임, 직업 crop과 수치 판독까지 끝낸 결과를 넘긴다.
- Main 검색 코드 가운데 Electron `session`, `Buffer`, `pngjs`, `node:zlib`, `node:timers/promises`, `node:crypto`, `node:fs`, `ipcMain`, main 진단 싱글톤, `ScoreEngine`에 닿는 곳은 브라우저로 그대로 옮기지 못한다. 문서 수명, 캡처 수명 판정은 이미 콜백으로 받는다(`capture-lifetime.ts`).
- 파티 프레임 검출(`packages/lib/src/dnf-party-frame-geometry.ts`)은 프레임 좌상단을 게임 client 원점으로 보고, 슬롯 번호도 절대 x 좌표로 정한다. 던파 창이 왼쪽 위에 있지 않은 전체 화면 스크린샷이나 임의 영역 캡처에서는 실패한다. 공대 상세 창은 프레임 어디에 있어도 찾지만 수치 판독은 1920×1080 이하 프레임에서만 한다.
- 네오플 초상화 URL(`img-api.neople.co.kr`)의 200 응답에 `Access-Control-Allow-Origin`이 없어 브라우저가 픽셀을 읽지 못한다. 운영 API에도 CORS 헤더가 없다.
- 배포된 Desktop v1.0.0, v1.0.2는 API의 card를 `z.strictObject`가 아닌 `z.object({ role })`로 받는다. API가 `score`를 객체로 바꿔도 구 배포본은 깨지지 않는다.
- 점수 엔진 바이너리 저장소에는 Windows DLL과 macOS dylib만 있다. Linux `.so`는 비공개 엔진 저장소에서 만들어야 한다.
- 사이트를 올리는 GitHub Pages는 COOP, COEP 헤더를 붙일 수 없어 `onnxruntime-web` WASM이 단일 스레드로 돈다. WebGPU는 쓸 수 있다.
- 관리자 권한으로 도는 던파 창도 일반 권한 Chrome, Edge의 `getDisplayMedia`로 정상 캡처되고, 다른 창에 가려져도 창 내용을 직접 받는다([Issue #1076](https://github.com/dungeon-and-dragon/dfragon/issues/1076)). 던파 창은 창 모드에서도 제목 표시줄이 없어(`WS_POPUP`) 화면 공유 프레임과 Alt+PrtSc 이미지는 게임 화면만 담는다. 공유 프레임은 폭이나 높이가 홀수이면 브라우저가 오른쪽이나 아래 1px을 버린다. 1067×600 창에서 받은 1066×600 프레임에서 기존 파티 검출이 그대로 동작했다.

## 선택지

| 선택지 | 첫 사용까지 | 고르지 않은 이유 |
| --- | --- | --- |
| A. Desktop 경량화(압축 설치본, 코드 서명) | 여전히 내려받고 실행해야 한다 | 압축해도 약 163MB이고, 서명은 예산이 없다([ADR 0001](0001-update-notice-without-auto-install.md)). 받기 전의 판단 장벽이 남는다. |
| B. 웹 앱을 사이트의 별도 경로에 둔다 | 첫 화면에서 한 번 더 이동한다 | 방문자가 첫 화면에서 바로 써 보지 못하고, 첫 화면의 목업과 실제 앱을 따로 유지해야 한다. |
| C. 브라우저에서 WASM 엔진으로 점수를 계산한다 | 엔진을 함께 받는다 | 비공개 엔진의 바이너리와 계산 데이터를 모든 방문자에게 내려보내게 되고, 엔진 저장소에 WASM 빌드를 새로 만들어야 한다. |
| D. 검색 코어를 새 workspace package로 꺼낸다 | E와 같다 | 검색 코어는 검색 수명과 요청 상태를 가진 Desktop 코드다. 웹 하나를 위해 package와 의존 방향 승인을 새로 늘릴 만큼 독립 계약이 없다([Architecture change](../architecture/overview.md#architecture-change)). |
| E. dfragon.com 첫 화면의 목업 자리에 웹 앱을 두고, 점수는 API가, 검색 코어는 Desktop 안 공용 폴더가 맡는다 | 첫 화면에서 바로 쓴다 | 채택 |

## 결정

E를 채택한다(2026-11-01 저장소 소유자 결정). Desktop은 게임 안에서 Alt+R을 쓰는 사용자를 위해 남긴다.

- **위치**: 웹 앱은 dfragon.com 메인 첫 화면의 목업 창 자리에 둔다. Desktop 내려받기는 보조 버튼이 된다.
- **입력**: 첫 웹 배포는 닉네임 검색, 스크린샷 붙여넣기(Ctrl+V), 화면 공유(`getDisplayMedia`) 캡처까지 넣는다.
- **전송 정보**: 사용자 화면 이미지는 브라우저 밖으로 보내지 않는다. OCR과 초상화 비교는 브라우저에서 하고, API는 캐릭터 검색, 상세와 네오플 초상화 전달을 맡는다.
- **초상화**: API가 네오플 PNG를 그대로 전달한다. 서버 메모리 캐시는 두지 않고 `Cache-Control`로 브라우저 캐시만 쓴다. [Issue #870](https://github.com/dungeon-and-dragon/dfragon/issues/870)에서 뺀 캐시 인터페이스와 캐시 바이트 상한은 되살리지 않는다.
- **점수**: 장비 점수와 버프 점수는 API가 계산해 상세 응답에 넣는다. API의 worker thread가 엔진 `libdnfscore.so`를 `koffi`로 불러 계산하고 1시간 상세 캐시에 함께 둔다. "`apps/api`는 엔진을 로드하지 않는다" 경계를 바꾼다. Desktop의 로컬 엔진은 Desktop이 API 점수로 옮길 때까지 남는다.
- **화면 구성**: 브라우저 host가 bridge 9개를 브라우저 API로 구현하고, Desktop renderer 컴포넌트와 hook을 그대로 쓴다. Renderer는 캡처 소스 요청, 붙여넣기로 회차 시작, 웹용 상태 문구 세 주입 지점만 고친다.
- **웹 entry**: Desktop의 `main.tsx`, `App.tsx`를 쓰지 않는다. 상단 바와 화면을 1280×163(공대 1280×300) 상자 안에 합성한 컴포넌트를 `@dfragon/desktop-web` 별칭으로 내보낸다. Desktop의 문서 전체 드래그 차단, `user-select: none`, `100dvh`가 사이트 전체로 번지지 않게 하려는 것이다.
- **검색 코어**: 새 workspace package를 만들지 않는다. Main의 `backend/search`와 공대 crop(`backend/capture/raid-frame.ts`, `backend/lib/raid-window.ts`)을 Desktop의 `src/shared/`로 옮기고, Electron, Node에 묶인 부분은 adapter로 받는다. Desktop은 Electron adapter를, 웹은 `fetch`와 `createImageBitmap` adapter를 넣고, 웹은 별칭으로 읽는다.
- **OCR**: Desktop과 같은 `onnxruntime-web` worker를 쓴다. 모델은 첫 붙여넣기나 첫 화면 공유 때 받으므로 닉네임 검색만 하는 사용자는 받지 않는다.
- **단축키, 클립보드**: 전역 단축키는 없고 페이지에 포커스가 있을 때만 Desktop과 같은 키를 받는다. 클립보드는 `navigator.clipboard`를 쓴다.
- **붙여넣기 안내**: 기본 안내는 Alt+PrtSc다. PrtSc 전체 화면은 던파 창이 왼쪽 위에 있을 때만 파티를 찾는다.
- **고려하지 않는 범위**: 휴대폰 방문자, API와 Neople API key 할당량, 게임 중 Alt+Tab 흐름은 이번 범위에서 고려하지 않는다. OCR 자산(모델 26.8MB, ONNX Runtime WASM 25.5MB, 약 54MB)은 줄이지 않고 배포 뒤 지켜본다.

## 결과

- 방문자는 설치 없이 첫 화면에서 바로 조회한다.
- API가 새로 네오플 초상화 요청과 점수 계산을 맡는다. API 이미지에 Linux 엔진과 `koffi`가 들어가고, 엔진 없이 시작할 때의 동작을 정해야 한다.
- 파티 검출이 client 원점을 가정하므로, Alt+PrtSc가 아닌 스크린샷 붙여넣기는 캡처 방법과 창 위치에 따라 실패할 수 있다. PrtSc, Win+Shift+S의 조건은 실기 결과로 [웹 클라이언트 Rule](../rules/web-client.md#붙여넣기-안내-범위)에 적는다.
- 단일 스레드 WASM과 WebGPU가 없는 PC에서는 OCR이 Desktop보다 느릴 수 있다.
- Desktop 검색 코어를 옮기는 동안 검색 수명의 취소, 늦은 응답 차단, 문서 수명 판정을 보존해야 한다. 실패하면 Desktop 회귀가 조용히 생긴다.
