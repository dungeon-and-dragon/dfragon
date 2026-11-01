---
type: rule
status: active
scope: desktop source organization and process boundaries
last-reviewed: 2026-11-01
---

# Desktop 코드 구조와 프로세스 경계

기존 Desktop 제품 구조 계약을 이 문서에서 관리한다. 공통 React UI 책임과 스타일은 [Design System](../rules/design-system.md#react-ui-책임), 앱 실행과 검증 명령은 [Desktop 안내](../../apps/desktop/README.md)를 따른다.

## 코드 소유권과 의존 방향

- Frontend UI는 `pages`(화면 배치) → `sections`(기능 조합, 요청과 구독 수명) → `components`(독립 UI)의 방향으로 의존한다. 하위 UI는 상위 UI나 fixture를 import하지 않고 props, callback으로 연결한다. 컴포넌트의 이미지 실패, 입력 draft 같은 자체 상태는 허용하며, 단순 태그나 전달 전용 wrapper로 계층을 채우지 않는다. 테스트, fixture의 조합은 이 제품 의존 규칙과 구분한다.
- Frontend UI의 props는 의미 단위로 받는다. 반복해 그리는 카드는 단위 값 하나(`lib/slot-cards.ts`의 `SlotCard`)와 화면 번호를 받고, 찾은 자리의 인식 이름 숨김처럼 단위 안에서 끝나는 표시 판단은 카드가 계산한다. 목록은 단위 값을 필드별로 풀어 다시 넘기지 않는다.
- Hook 결과에서 함께 바뀌는 값과 동작(캡처 회차, 스냅샷, 자리 배치, 창 목록)은 hook 필드 이름 그대로 한 prop으로 받고 `onX` 같은 이름으로 다시 풀지 않는다. 하위 UI가 상위 상태를 hook에 전달만 하면 그 상태는 hook이 소유한다. 하위가 쓰지 않는 값을 전달만 하게 되면 상위가 조립한 요소를 `ReactNode` 슬롯으로 넘긴다. 두 화면에 같은 마크업이 있으면 `components`로 하나 꺼내고 차이는 값으로 받는다. 값 하나의 표시 옵션이나 출처가 다른 독립 값은 개수를 줄이려고 묶지 않는다.
- 독립적으로 재사용할 UI는 역할이 드러나는 파일에 named export로 두고, 전용 스타일, 테스트는 소유한 UI와 가까이 둔다. 공용 Button, Input 같은 기본 UI는 기존 `@dfragon/ui`를 사용한다.
- Frontend `src/frontend/src/components`, `sections`는 하위 폴더 없이 배치하고 파일당 컴포넌트 하나를 선언한다. 같은 도메인 맥락의 JSX를 읽기 쉽게 나눌 때는 export하지 않는 보조 컴포넌트를 같은 파일에 둘 수 있다. 보조 컴포넌트를 다른 파일에서 쓰거나 따로 테스트해야 하면 별도 파일로 꺼낸다. 전용 스타일은 [공통 스타일 계약](../rules/design-system.md#화면별-스타일-조정)을 따른다. `sections`에는 UI 조합, 스타일, UI 테스트를 두고, 독립적인 검색 연결, OCR worker 같은 비UI 구현은 `lib`에 둔다.
- Frontend의 UI와 독립적인 구현, 공통 유틸리티는 `src/frontend/src/lib`, 공통 타입은 `types`, 상수는 `constants`에서 역할별 파일로 관리하고 직접 import한다. `lib`는 하위 폴더 없이 파일을 바로 둔다. 이 모듈은 UI 계층이나 fixture를 import하지 않는다. 요청, 구독 수명을 관리하는 class도 `lib`에 두고 구현 전용 타입은 해당 파일에 유지하며, process 간 IPC contract는 기존 preload 위치를 사용한다.
- Frontend 커스텀 hook은 기능 전용 여부와 관계없이 `src/frontend/src/hooks`에 하위 폴더 없이 모으고, hook 전용 테스트는 옆에 둔다. Hook은 다른 hook과 기존 검색, OCR 등의 비UI 구현을 직접 참조할 수 있지만 UI 컴포넌트, page, fixture, testing을 import하지 않는다.
- Frontend의 `src/frontend/src/testing`에는 여러 테스트가 공유하는 유틸리티, mock, fixture만 둔다. 실제 테스트 파일은 검증하는 코드 옆에 두고, 앱 조합 통합 테스트는 기존 `integration`에 둔다. 제품 코드는 `testing`을 import하지 않는다. 직접 실행하는 미리보기, Electron fixture는 기존 `fixture`에 유지한다.
- `src/frontend/src/site`는 웹사이트(`apps/web`)가 import하는 entry를 둔다. 웹 앱 entry(`web/index.ts`, 별칭 `@dfragon/desktop-web`, 2026-11-01 [ADR 0004](../adr/0004-web-client.md))는 Desktop의 `main.tsx`, `App.tsx` 대신 실제 상단 바와 카드 컴포넌트를 1280×163(공대 1280×300) 상자 안에 합성하고 브라우저 host로 연결한다([웹 클라이언트](../rules/web-client.md)). 첫 화면 배경의 시간대 그림 entry(`time-of-day.ts`, 별칭 `@dfragon/desktop-site/time-of-day`, 2026-10-31 [Issue #1037](https://github.com/dungeon-and-dragon/dfragon/issues/1037))도 이 폴더에 둔다. 웹 앱 전용 hook, 데이터, 그림도 이 폴더에 둔다. 앱 진입점과 다른 Frontend 코드는 이 폴더를 import하지 않는다. 카드나 상단 바 컴포넌트를 바꾸면 Web 검사도 함께 실행한다.
- `src/backend/main.ts`와 `src/preload/index.ts`는 composition root로 유지한다. App lifecycle, module 등록, API 노출만 두고 feature state, handler body, domain logic은 넣지 않는다.
- Feature 관련 implementation과 test는 process별 feature 위치에 함께 둔다. 예: `src/backend/capture/**`, `src/preload/api/capture.ts`.
- `src/shared/`는 Electron main과 브라우저(웹 앱 entry)가 함께 쓰는 검색 코어와 그 테스트 fixture(`search`), 공대 crop과 템플릿 PNG(`raid`)를 둔다(2026-11-01 [ADR 0004](../adr/0004-web-client.md)). 새 workspace package 대신 Desktop 안에 두는 폴더이며 process 간 IPC contract와는 다르다. 이 폴더는 `electron`, `node:*`, `Buffer`처럼 Node나 Electron에만 있는 API와 DOM에만 있는 전역을 쓰지 않고, `src/preload/common`의 IPC contract 타입과 순수 검색 helper, `@dfragon/lib`와 두 환경에서 함께 도는 라이브러리만 import한다. `tsconfig.shared.json`이 이 폴더만 `types: []`로 따로 typecheck해 Node 전역과 `node:*`를 잡고, Biome이 `electron` import를 막는다. HTTP 요청, 이미지 디코딩, 작업 양보, 진단 기록, 템플릿 이미지 읽기처럼 실행 환경에 묶인 일은 adapter로 받는다. Desktop은 `src/backend`가 Electron adapter를, 웹은 브라우저 host가 `fetch`, `createImageBitmap` adapter를 넣는다. 의존 방향은 `src/backend`, 웹 앱 entry(`src/frontend/src/site`), `apps/web`(별칭 `@dfragon/desktop-shared/*`) → `src/shared/`이며, `src/shared/`는 `src/backend`, `src/frontend`, `src/preload/api`를 import하지 않는다. `ipcMain`에 닿는 연결 코드(`src/backend/search/manual-ipc.ts`)와 Electron adapter(`src/backend/lib/character-png.ts`, `raid-window-templates.ts`, `src/backend/score/card-score.ts`)는 `src/backend`에 남긴다.
- Desktop main의 공통 Windows 화면 획득은 `src/backend/lib`가 소유한다. 파티와 공대 캡처는 같은 GDI, DPI, 픽셀 변환과 자원 정리 구현을 사용한다. 이 lib는 검색, UI와 IPC handler에 의존하지 않으며 각 기능이 획득 결과를 자기 계약으로 변환한다. 네이티브 DLL과 Node API는 Desktop 내부에 유지하고 순수 함수용 `packages/lib`로 옮기지 않는다.
- Backend handler와 preload invoker의 argument 및 return type은 shared IPC contract에서 파생한다.
- TypeScript IPC contract가 있더라도 renderer에서 전달되는 값은 backend trust boundary에서 runtime validation한다.
