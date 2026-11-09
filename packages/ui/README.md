# 공용 UI

`@dfragon/ui`는 던삐삐 디자인 토큰과 Base UI(`@base-ui/react`) 기반 공용 Component를 제공한다. 동작과 접근성은 Base UI 부품이, 외형은 `--df-*` 토큰만 쓰는 StyleX가 맡는다. 제품 data, event, platform 연결은 소비 app이 소유한다.

## Public API

| Component | 바탕 | 요약 |
| --- | --- | --- |
| `Button` | native `button` | `variant` `primary`, `secondary`(기본), `ghost`, `danger`와 `size` `sm`, `md`(기본), `lg`(32, 40, 48px). `primary`는 신호색 면이다. `loading`은 진행 원을 겹치고 클릭을 막지 않는다. |
| `IconButton` | native `button` | 회색 면 없이 hover 때 아이콘이 밝아진다. `aria-label`, `icon` 필수, `size` `sm` 32, `md` 40, `bar` 36(상단 바 도구 버튼, 아이콘 20), `lg` 48(화면 헤더 도구 버튼, 아이콘 24, `bg.inset` 면). `pressed`를 주면 켜고 끄는 토글로 `aria-pressed`를 전하고 켜진 동안 아이콘과 안쪽 2px 선이 신호색이다. |
| `TextField`, `TextFieldLabel`, `TextFieldInput`, `TextFieldDescription`, `TextFieldError` | `Field`, `Input` | `TextField`가 `invalid`, `disabled`, `name`, `size` `sm`, `md`, `lg`를 받고, 안에 둔 라벨, 설명, 오류를 입력에 연결한다. 글자는 각 부품의 `children`으로 주며 `TextFieldError`는 `invalid`일 때만 보인다. `value`, `defaultValue`, `onValueChange(value)`, `readOnly`, `required`는 `TextFieldInput`이 받고, 입력 요소 합성은 `render`다. |
| `Select` | `Select` | `Root`, `Trigger`(칩, `size` `2xs`, `xs`, `sm`, `md`. `2xs`는 표 행의 서버 칩으로 높이 20, 글자 11 500에 흐린 글자이고 올리면 밝아진다), `Value`, `Popup`(Portal, Positioner, Popup, List), `Item`, `ItemText`, `Group`, `GroupLabel`, `Separator`. 캐릭터 행에서는 `Trigger`와 `Popup`에 `surface="card"`를 넘긴다. 이 칩은 열어도 신호색으로 채우지 않고 올린 면에 밝은 글자이며, 목록은 표 행 위 팝오버(`bg.surface` 면, `border.strong` 1px 테두리, 그림자, 84×32px 항목 격자)다. `Popup`의 `columns`는 항목을 그 수의 열로 읽는 순서대로 늘어놓는 격자 목록이고, 없으면 한 줄 목록이다. |
| `Menu` | `Menu` | `Root`, `Trigger`(외형 없음, `render`로 연결), `Popup`, `Item`, `RadioGroup`, `RadioItem`, `Group`, `GroupLabel`, `Separator`. |
| `Tabs` | `Tabs` | `Root`, `List`(현재 탭 2px 선 포함), `Tab`, `Panel`. `List`의 `surface="card"`는 카드 면 탭이다. 탭이 폭을 나눠 채우고(높이 40, 글자 13) 현재 탭 선이 위쪽에 있으며 `card*` 토큰으로 그린다. |
| `Switch`, `Checkbox`, `Chip` | `Switch`, `Checkbox`, `Toggle` | 한 요소로 쓰는 켜고 끄는 컨트롤. 이름은 감싼 label이나 `aria-label`로 준다. |
| `Tooltip` | `Tooltip` | `Provider`, `Root`, `Trigger`, `Popup`. Popup은 메뉴 popup과 같은 `bg.inset` 면, 위쪽 2px `signal` 선, 안쪽 `border.strong` 선에 그림자를 둔다. |
| `StatusChip` | `span` | tone `neutral`(`fg.subtle`), `success`, `danger`, `warning`(주의, `fg.warning`), `signal`(진행 중인 일)이고, 모두 글자색 둥근 점과 같은 색 12% 안팎의 옅은 면이다. `success` 점은 박자 두 번 주기로 깜박인다. `busy`면 둥근 점 대신 `StepDots`를 둔다. `size` `sm`은 높이 24, `md`는 상단 바 게임 연결 상태의 높이 28이다. 상태 변화를 알릴 곳만 `role="status"`를 넘긴다. |
| `StepDots` | plain | 글자색 사각 점 세 개가 `motion.beat`마다 `steps()`로 차례로 켜진다. `size` 4(상태 칩 안, 3px 간격)와 5(목록 안내, 4px 간격). 동작 줄이기에서는 모두 켠 채 멈추고, 보조 기술에는 숨긴다. |
| `LoadingIndicator`, `ProgressCircle` | 자체 SVG | 값이 없으면 `steps()`로 끊어 도는 호, 있으면 진행 호. |
| `Kbd`, `NumericText` | plain | 단축키(22px 키캡, 숫자 글꼴 14 700. `surface="signal"`은 주 버튼 안의 키캡으로 버튼 글자색과 그 55% 외곽선을 쓴다), 숫자 글꼴(`font.num`, `tabular-nums`)과 400ms 증가. |
| `ContentStack`, `ExampleSection`, `SupportingText` | plain | 예제와 단순 화면의 세로 묶음, 제목, 보조 글자. |
| `Typo` | plain | `Typo.h1`–`h6`, `txtL`, `txtM`, `txtS`, `caption`과 `typographyVariants`, `TypoProps`, `TypoTag`, `TypoVariant` 타입. |

공개 타입은 `className`, `style`을 받지 않는다. Base UI 부품 그대로인 `Select.Root`, `Menu.Root` 같은 부품은 Base UI 문서의 API를 따른다.

Entry는 다음과 같다.

- `@dfragon/ui`: 위 Component와 공용 `stylex.create`인 `shapes`(`srOnly`). StyleX compiler가 필요하다.
- `@dfragon/ui/tokens.stylex`: `colors`, `shadow`, `space`, `radius`, `size`, `motion`, `font` 토큰 상수. Source를 가리켜 library를 먼저 빌드하지 않아도 된다.
- `@dfragon/ui/typo`: Typo만 내보내는 React 전용 entry. Base UI와 StyleX 없이 쓴다.
- `@dfragon/ui/tokens.css`: `--df-*` 변수와 라이트, 다크 모드 값.
- `@dfragon/ui/foundation.css`: system font stack과 body 초기화(여백, 글자색, 바탕). Root font-size는 지정하지 않는다.

`@base-ui/react`, React, React DOM과 `@stylexjs/stylex`는 peer이다. Library build는 이들을 external로 두고 CSS를 출력하지 않는다.

## 공통 StyleX 설정

`@dfragon/ui/stylex-config`는 모든 앱과 Example, test가 쓰는 compiler 옵션이다. Browser runtime에서 import하지 않는다. StyleX runtime과 compiler 버전은 `pnpm-workspace.yaml`의 catalog에 두고, 앱 manifest는 `@stylexjs/stylex`와 개발 의존성 `@stylexjs/unplugin`을 `catalog:`로 참조한다.

- `runtimeInjection: false`로 production CSS를 빌드 때 추출한다. 주입 runtime(`@stylexjs/stylex/lib/stylex-inject`)은 쓰지 않는다.
- `useCSSLayers: false`로 공용 토큰 CSS, foundation, 앱 전역 글꼴 CSS와 같은 cascade에서 조합한다.
- Vite에서는 StyleX를 React plugin보다 먼저 실행한다. Vitest는 HTTP/HMR timer가 없는 Rollup adapter를 쓴다.
- 모든 browser entry는 `@dfragon/ui/tokens.css`, `@dfragon/ui/foundation.css`, 앱 전역 글꼴 CSS 순서로 한 번 import한다. 앱은 모드 값을 따로 넣지 않으며, 사용자가 고른 모드만 첫 그리기 전에 `html`의 `data-color-mode`로 붙인다.

연결 위치는 웹 앱 package test의 `apps/web/vitest.config.ts`, 공용 UI Example과 test의 `packages/ui/examples/vite.config.ts`, `packages/ui/vitest.config.ts`, 공용 UI 산출물 소비 검사의 `packages/ui/test/build-consumer/vite.config.ts`다.

공식 [unplugin 설정](https://stylexjs.com/docs/api/configuration/unplugin/)과 [Vite 연결](https://stylexjs.com/docs/learn/installation/vite/)을 따른다. `apps/web`과 Example은 Vite/Vitest의 exact `@dfragon/ui` alias와 TypeScript paths로 public source entry를 직접 해석하므로 library build 없이 source 변경이 반영된다.

## Command

Repository root에서 실행한다.

- `pnpm --filter @dfragon/ui build`: ESM bundle, declaration 생성 뒤 public package export의 소비 검사.
- `pnpm --filter @dfragon/ui verify:build`: 기존 library 산출물의 export, dependency, CSS, 고지, declaration과 Vite 소비 fixture 검사.
- `pnpm --filter @dfragon/ui dev:examples`: 독립 Vite Example.
- `pnpm --filter @dfragon/ui build:examples` / `preview:examples`: production Example 생성, 확인.
- `pnpm --filter @dfragon/ui test`: typecheck, Vitest interaction과 Typo, 빌드 검사 도구의 Node 회귀를 차례로 실행한다.
- `pnpm --filter @dfragon/ui exec vitest run test/interaction.test.tsx`: 고른 runtime 테스트만 실행한다. 파일 인수를 aggregate `test`에 넘기지 않는다.
- `pnpm --filter @dfragon/ui typecheck`: src, test, examples를 `tsc --noEmit`으로 검사한다.
- `pnpm --filter @dfragon/ui test:tooling`: 임시 산출물로 빌드 검사 도구를 확인한다. Library 선행 build 없이 실행한다.
- `pnpm --filter @dfragon/ui test:consumer-lifecycle`: POSIX detached child/group 종료 검사. 일반 `test`와 분리하며 macOS에서 검증한다.
- `pnpm --filter @dfragon/ui lint`
- `node packages/ui/scripts/verify-build.mjs library packages/ui/dist`: library 산출물 검사.
- `node packages/ui/scripts/verify-build.mjs consumer <산출물 경로>`: 소비 앱 산출물 검사.
- `node --test packages/ui/scripts/test-consumer-resolution.mjs`: 전용 checkout의 cold consumer command 회귀. 격리 조건은 script 머리 주석에 있다.

## 고지

Library, Example, Web build는 [`@dfragon/licenses`](../licenses/README.md)의 공용 `uiNotices` plugin으로 bundle 입력의 dependency license/NOTICE와 module, chunk 목록을 산출물 `notices`에 기록하며 absolute filesystem path는 남기지 않는다. `@dfragon/ui`에는 외부 source를 복사해 고친 코드가 없어 별도 수정 고지를 두지 않는다.

## 소비 entry와 실제 UI 확인

`apps/web`은 공용 Component와 토큰을 화면에서 직접 쓴다. 공용 UI 변경은 `dev:examples`, `preview:examples`와 변경한 소비 앱 화면을 브라우저에서 확인한다.
