---
type: rule
status: active
enforcement: approval-required
scope: dfragon.com web client
last-reviewed: 2026-11-01
rationale: 웹 클라이언트가 Desktop renderer를 같이 쓰면서 전송 정보, 입력, 플랫폼 연결을 어디까지 바꾸는지 정한다.
evidence: "2026-11-01 ADR 0004 저장소 소유자 결정 ; 2026-11-01 #1076 화면 공유, Alt+PrtSc 실기 확인"
exceptions: 화면 이미지를 브라우저 밖으로 보내는 기능과 전역 단축키는 새 결정 없이 더하지 않는다.
review-after: 모바일 지원 범위, 사이트 hosting, Desktop bridge 구성 변경 전
---

# 웹 클라이언트

dfragon.com 첫 화면에서 설치 없이 쓰는 웹 클라이언트의 계약을 정한다. 결정의 이유와 고르지 않은 대안은 [ADR 0004](../adr/0004-web-client.md)에 있다. 상단 바, 카드, 검색과 캡처 회차의 동작은 [Desktop MVP 카드 UI](desktop-mvp-ui.md)와 [캐릭터 검색](character-search.md)을 그대로 따르고, 이 문서는 웹에서 달라지는 것만 정한다. 앱 경계와 점수 엔진 위치는 [Architecture Overview](../architecture/overview.md), 웹 entry와 공용 검색 코어의 파일 위치는 [Desktop 코드 구조](../architecture/desktop-code-organization.md)를 따른다.

## 위치와 화면

- 웹 앱은 dfragon.com 메인 첫 화면의 창 목업 자리에 둔다. Desktop 내려받기는 보조 버튼이다. 사이트 소개 문구의 문체는 [표기와 문체](writing.md#사용자-문구의-문체)를 따르고, 앱 화면 문구는 Desktop과 같은 합니다체다.
- 웹 entry는 Desktop의 `main.tsx`, `App.tsx`를 쓰지 않는다. 상단 바와 파티 화면을 1280×163, 공대 화면을 1280×300 상자 안에 합성한 컴포넌트를 `@dfragon/desktop-web` 별칭으로 내보낸다. Desktop의 문서 전체 드래그 차단, `user-select: none`, `100dvh`는 이 상자 밖의 사이트에 적용하지 않는다.

## 지원 범위

웹 클라이언트는 데스크톱 브라우저만 지원하고, 휴대폰과 좁은 화면은 지원하지 않는다(2026-11-01 저장소 소유자 결정). 모바일 앱(native client)도 만들지 않는다. 휴대폰과 좁은 화면용 레이아웃, 입력을 두지 않으며, 창이 앱 상자보다 좁으면 상자 안에서 가로로 스크롤한다.

## 입력

웹은 세 입력을 지원하고, 세 입력 모두 Desktop과 같은 카드에 결과를 채운다.

- **닉네임 검색**: Desktop처럼 카드의 이름 칸과 서버 선택으로 그 자리만 조회한다.
- **스크린샷 붙여넣기**: 페이지에서 붙여 넣은(Ctrl+V) 이미지 한 장을 `{ width, height, rgba }` 프레임으로 바꿔, 지금 보이는 화면(파티, 공대)의 회차 하나를 시작한다. 파티는 renderer가 프레임 전체를 받아 crop하고, 공대는 공용 공대 crop이 브라우저에서 12행 결과를 만들어 renderer에 넘긴다.
- **화면 공유**: 브라우저의 `getDisplayMedia`로 공유받은 던파 창에서 회차 프레임을 읽는다. 던파 창은 창 모드에서도 제목 표시줄이 없어(`WS_POPUP`) 공유 프레임이 곧 게임 client다. 폭이나 높이가 홀수이면 브라우저가 오른쪽이나 아래 1px을 버린다.

[Desktop Windows 캡처 정책](desktop-windows-capture.md)의 Electron media 권한 거절과 네이티브 창 캡처는 Desktop에만 적용한다. 웹은 브라우저의 화면 공유 권한을 쓴다.

### 붙여넣기 안내 범위

붙여넣기의 기본 안내는 Alt+PrtSc다. 던파 창은 창 모드에서도 제목 표시줄이 없어 Alt+PrtSc 이미지에는 게임 화면만 들어간다.

파티 프레임 검출은 프레임 좌상단을 게임 client 원점으로 보므로, 던파 창이 왼쪽 위에 있지 않은 전체 화면 스크린샷이나 임의 영역 캡처에서는 파티를 찾지 못한다. 공대 상세 창은 프레임 어디에 있어도 찾지만 수치는 1920×1080 이하 프레임에서만 읽는다.

PrtSc(전체 화면)와 Win+Shift+S로 찍은 이미지가 어떤 조건에서 되는지는 Windows 실기 결과로 [Issue #1085](https://github.com/dungeon-and-dragon/dfragon/issues/1085)가 이 절에 채운다.

## 전송 정보

| 정보 | 가는 곳 |
| --- | --- |
| 입력하거나 인식한 닉네임, 고른 서버 | API(`api.dfragon.com`)의 캐릭터 검색 |
| 조회한 캐릭터의 서버와 캐릭터 ID | API의 캐릭터 상세, 초상화 전달 |
| 붙여 넣거나 공유한 화면 이미지와 그 crop | 브라우저 밖으로 보내지 않는다 |
| 공대 행에서 읽은 직업명, 수치와 초상화 비교 거리 | 브라우저 밖으로 보내지 않는다. 인식한 닉네임과 비교로 고른 캐릭터만 위 검색, 상세 요청에 쓴다 |

- OCR은 Desktop과 같은 `onnxruntime-web` worker로 브라우저에서 한다. 모델은 첫 붙여넣기나 첫 화면 공유 때 사이트에서 받으므로 닉네임 검색만 하는 사용자는 받지 않는다. 사이트 hosting이 COOP, COEP 헤더를 붙일 수 없어 WASM은 단일 스레드로 돌고, WebGPU가 있으면 쓴다.
- 장비 점수와 버프 점수는 API가 상세 응답에 넣은 값만 보인다. 브라우저는 점수 엔진을 받거나 로드하지 않는다([점수 엔진 경계](../architecture/overview.md#점수-엔진-경계)). 점수가 없으면 Desktop처럼 `-`로 둔다.

## 초상화 전달

웹은 후보 초상화를 네오플 이미지 서버 대신 API에서 받고, 얼굴 크롭과의 비교는 브라우저에서 한다. 네오플 이미지 서버를 직접 쓰지 않는 이유는 [ADR 0004](../adr/0004-web-client.md#확인한-사실)에 있다.

- API는 네오플의 PNG를 변환하지 않고 그대로 전달한다.
- API는 초상화를 서버 메모리에 캐시하거나 저장하지 않는다. 응답의 `Cache-Control`로 브라우저 캐시만 쓴다.
- API 캐시에는 [Issue #870](https://github.com/dungeon-and-dragon/dfragon/issues/870)에서 뺀 캐시 인터페이스와 캐시 바이트 상한을 두지 않는다.
- 경로, 입력 검증, 오류는 [캐릭터 검색](character-search.md)이 정한다. Desktop은 지금처럼 네오플 이미지 서버에서 직접 받는다.

## 단축키

웹에는 전역 단축키가 없다. 페이지에 포커스가 있을 때만 Desktop과 같은 키(캡처 Alt+R, 스냅샷 Alt+W, 복사 Alt+A, 카드 자리 맞바꾸기 Alt와 방향키)를 받는다. 페이지 밖, 게임 창이 앞에 있을 때는 받지 않는다.

## 클립보드

웹의 클립보드로 복사는 `navigator.clipboard`로 글자를 쓴다. 복사 형식, 결과 표시, 단축키는 [Desktop의 클립보드로 복사](desktop-mvp-ui.md#클립보드로-복사)와 같다. 그 절의 "renderer의 Clipboard API를 쓰지 않는다"는 Electron 권한 정책 때문에 정한 Desktop만의 경로이며 웹에는 적용하지 않는다. 클립보드 읽기는 두지 않는다.

## Renderer 주입 지점

Renderer는 Electron을 직접 참조하지 않고 `apps/desktop/src/preload/index.d.ts`의 bridge 9개(`api`, `search`, `raidSearch`, `desktopShortcut`, `desktopClipboard`, `todayGrade`, `diagnostics`, `updateNotice`, `windowChrome`)로만 플랫폼에 닿는다. 웹은 9개를 모두 브라우저 API로 구현한 브라우저 host를 넣어 Desktop renderer 컴포넌트와 hook을 그대로 쓴다. `search`, `raidSearch`는 공용 검색 코어에 `fetch`, `createImageBitmap` adapter를 넣어 구현하고, `desktopClipboard`는 위 [클립보드](#클립보드)를 따른다.

Renderer 컴포넌트와 hook은 아래 세 주입 지점만 고친다. 그 밖의 웹 전용 분기는 renderer에 넣지 않고 브라우저 host와 웹 entry에 둔다. 주입 지점을 고쳐도 Desktop의 동작과 문구는 바뀌지 않는다.

- **캡처 소스 요청**: Desktop의 창 목록 선택 대신 화면 공유를 요청하는 길을 host가 넣는다.
- **붙여넣기로 회차 시작**: 창 선택 다음 회차 시작 순서 밖에서, 붙여 넣은 프레임으로 회차를 시작하는 길을 host가 넣는다.
- **웹용 상태 문구**: "Alt+R을 눌러…"처럼 Desktop 입력을 안내하는 상태 문구를 웹에서는 붙여넣기, 화면 공유 기준 문구로 보인다.
