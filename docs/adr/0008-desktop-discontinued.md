---
type: adr
status: accepted
scope: apps/desktop 중단, apps/web의 Desktop 안내, packages/client-core, packages/client
decided: 2026-11-03
last-reviewed: 2026-11-03
superseded-by: 없음
evidence: "Issue #1122 정한 것, 지금 구조의 문제(https://github.com/dungeon-and-dragon/dfragon/issues/1122) ; 저장소 소유자 결정(2026-11-03)"
review-after: Desktop을 다시 배포해야 할 때, API의 이전 Desktop 호환 필드를 지울 때
---

# ADR 0008: Desktop을 중단하고 Web이 쓰는 코드를 client-core, client package로 옮긴다

## 상태

채택. [ADR 0001](https://github.com/dungeon-and-dragon/dfragon/blob/v1.0.2/docs/adr/0001-update-notice-without-auto-install.md), [ADR 0002](https://github.com/dungeon-and-dragon/dfragon/blob/v1.0.2/docs/adr/0002-desktop-usage-stats-ga4.md), [ADR 0003](https://github.com/dungeon-and-dragon/dfragon/blob/v1.0.2/docs/adr/0003-remove-desktop-usage-stats.md)이 다룬 Desktop 앱을 더 이상 개발하지 않는다. 이 세 ADR은 `v1.0.2` tag에서 읽는다. [ADR 0004](0004-web-client.md)의 웹 클라이언트가 Desktop을 대신한다. 구현은 [Issue #1122](https://github.com/dungeon-and-dragon/dfragon/issues/1122)의 sub-issue로 나눠 진행한다.

## 맥락

[ADR 0004](0004-web-client.md)의 웹 클라이언트(dfragon.com)가 닉네임 검색, 스크린샷 붙여넣기, 화면 공유의 같은 인식과 검색을 설치 없이 제공한다. Desktop은 서비스상 더 이상 의미가 없다.

그런데 `apps/web`의 실제 웹 앱은 `apps/desktop` 안에 있다. `apps/web/workspace-aliases.ts`와 `tsconfig.app.json`이 `@dfragon/desktop-web`, `@dfragon/desktop-shared`, `@dfragon/desktop-site` 별칭으로 Desktop renderer를 직접 import한다. 웹 진입점에서 닿는 Desktop 파일은 테스트를 빼고 약 200개, 1만 4천 줄이다. 글꼴, 시간대 배경 그림, OCR 자산 준비 script와 그 입력도 Desktop 경로에 있다. renderer는 Electron preload가 만든 `window.api`, `window.search` 같은 전역 9개를 부르고, 웹에서는 브라우저 host가 이 전역을 흉내 내 붙인다. 그래서 `apps/desktop`을 그냥 지우면 Web이 깨진다.

## 결정

- **보존**: Desktop 소스 보존 지점은 기존 [`v1.0.2` tag](https://github.com/dungeon-and-dragon/dfragon/tree/v1.0.2)이다. 새 tag는 만들지 않는다. `v1.0.2` 뒤의 Desktop 변경은 git 히스토리에만 남는다. main에서는 Desktop을 지운다.
- **Releases**: 기존 GitHub Releases(v1.0.x 포터블 exe)는 그대로 둔다.
- **안내**: 기존 exe 사용자에게 Web 이전 안내 릴리스를 내지 않는다.
- **Web 첫 화면**: Desktop 안내와 Windows용 내려받기 버튼을 지운다. GitHub Releases API도 부르지 않는다. 웹 앱 안의 Alt+R(웹 페이지가 앞에 있을 때의 단축키)은 그대로 둔다.
- **package**: 웹이 쓰는 코드를 두 package로 옮긴다. 둘 다 build 없이 source를 export하고 Web의 Vite가 직접 번들한다.
  - `@dfragon/client-core`(packages 아래 client-core 디렉터리): `apps/desktop/src/shared/**`, `apps/desktop/src/preload/common/**`. React와 DOM에 의존하지 않는 검색, 공대 로직과 타입이다.
  - `@dfragon/client`(packages 아래 client 디렉터리): `apps/desktop/src/frontend/src/**` 가운데 웹이 쓰는 것. 컴포넌트, hook, `lib`(OCR 포함), WebApp, browser host다.
- **이동 방식**: 첫 이동은 디렉터리 기준 `git mv`로 동작을 바꾸지 않는다. 전역 bridge 제거, Desktop 전용 기능 정리, `frontend/src/lib`의 순수 로직을 core로 옮기는 일은 뒤 PR에서 한다.
- **PR 묶음**: 이동과 Desktop 삭제는 한 PR에서 한다. 그 사이 Desktop을 새 package에 연결하는 버릴 작업을 하지 않는다.
- **문서**: Desktop 전용만 지운다(Rule 2개, `docs/architecture/desktop-code-organization.md`, ADR 0001~0003). ADR 0004~0007은 결정 기록이라 고치지 않는다.
- **공용 package**: `@dfragon/lib`, `@dfragon/ui`, `@dfragon/licenses`에 남는 Desktop 전용 코드도 찾아서 지운다.
- **API**: "이전 Desktop 호환" 필드는 이번에 지우지 않고 따로 정리한다. 시점은 저장소 소유자가 정한다.
- **models**: `packages/models`는 Web(OCR 모델)과 API(점수 엔진)가 계속 쓰므로 남긴다.

## 결과

- 기존 exe는 API의 이전 Desktop 호환 필드가 지워질 때까지만 동작한다. 안내 없이 중단하므로 그 시점에 상세 조회가 깨진다.
- 웹 앱의 코드는 Desktop 없이 `@dfragon/client-core`, `@dfragon/client` package에서 개발한다.
- 이동 PR은 파일 수가 많다. rename 위주로 만들고 리뷰는 rename이 아닌 변경(import 경로, 설정, 검사 job)에 집중한다.
- 이 ADR을 쓰는 PR은 문서와 Web 첫 화면만 바꾼다. `apps/desktop`과 그 workflow, 검사 job은 다음 sub-issue에서 지운다.
