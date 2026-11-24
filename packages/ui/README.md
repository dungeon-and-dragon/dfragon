# 공용 UI

`@dfragon/ui`는 Base UI(`@base-ui/react`) 기반 공용 Component를 제공한다. 동작과 접근성은 Base UI 부품이 맡는다. 외형은 모두 `@dfragon/design/components.css`의 클래스로 그린다. 토큰 값은 `@dfragon/design`에 있다. 제품 data, event, platform 연결은 소비 app이 소유한다.

## Public API

| Component | 바탕 | 요약 |
| --- | --- | --- |
| `Button` | native `button` | `variant` `primary`, `secondary`(기본), `ghost`, `danger`와 `size` `sm`, `md`(기본), `lg`(32, 40, 48px). `primary`는 신호색 면이다. `loading`은 `data-loading`으로 글자를 투명하게 가리고 진행 호를 그리며 클릭을 막지 않는다. |
| `IconButton` | native `button` | 평소에는 면이 없고 hover 때 `inset` 면에 아이콘이 밝아진다. `aria-label`, `icon` 필수, `size` `sm` 32, `md` 40(아이콘 20), `lg` 48(화면 헤더 도구 버튼, 아이콘 24, `inset` 면). `pressed`를 주면 켜고 끄는 토글로 `aria-pressed`를 전하고 켜진 동안 안쪽 2px 선이 신호색이다. |
| `TextField`, `TextFieldLabel`, `TextFieldInput`, `TextFieldDescription`, `TextFieldError` | `Field`, `Input` | `TextField`가 `invalid`, `disabled`, `name`, `size` `sm`, `md`, `lg`를 받고, 안에 둔 라벨, 설명, 오류를 입력에 연결한다. 글자는 각 부품의 `children`으로 주며 `TextFieldError`는 `invalid`일 때만 보인다. `value`, `defaultValue`, `onValueChange(value)`, `readOnly`, `required`는 `TextFieldInput`이 받고, 입력 요소 합성은 `render`다. |
| `Select` | `Select` | `Root`, `Trigger`(`size` `2xs`, `xs`, `sm`, `md`. `2xs`는 표 행의 서버 칩으로 높이 24에 테두리가 없고 흐린 글자이며 올리거나 열면 면이 생긴다), `Value`, `Popup`(Portal, Positioner, Popup, List), `Item`, `ItemText`, `Group`, `GroupLabel`, `Separator`. `Popup`의 `columns`는 항목을 그 수의 열로 읽는 순서대로 늘어놓는 격자 목록이고, 없으면 한 줄 목록이다. |
| `NumberField` | `NumberField` | 숫자 양옆의 내리기(`MinusIcon`), 올리기(`PlusIcon`) 버튼으로 한 칸씩 바꾸는 숫자 칸. `value`, `onValueChange(value)`, `min`, `max`, `disabled`, `format`(`Intl.NumberFormatOptions`)을 받는다. 이름은 `aria-label`(필수)이고, 버튼 이름은 그 뒤에 `내리기`, `올리기`를 붙인다(`decrementLabel`, `incrementLabel`로 바꾼다). 범위 끝에 닿은 쪽 버튼은 막히고, 입력칸에서 위, 아래 화살표로도 바꾼다. 높이는 표 행 안의 작은 컨트롤 높이 하나이고 숫자 글자색은 놓인 자리를 따른다. |
| `Tabs` | `Tabs` | `Root`, `List`(현재 탭 아래로 움직이는 2px 선 포함), `Tab`, `Panel`. |
| `Switch`, `Chip` | `Switch`, `Toggle` | 한 요소로 쓰는 켜고 끄는 컨트롤. 이름은 감싼 label이나 `aria-label`로 준다. |
| `Checkbox` | `Checkbox` | 16px 상자에 켜진 동안 `CheckIcon`을 그리는 체크박스. `checked`, `defaultChecked`, `onCheckedChange(checked)`, `disabled`를 받는다. 이름은 감싼 label이나 `aria-label`로 준다. |
| `ChipGroup` | `ToggleGroup`, `Toggle` | `items`(`value`, `label`) 가운데 하나만 고르는 칩 묶음. 고른 칩을 다시 눌러도 선택이 풀리지 않는다. 화살표로 칩 사이를 옮기고 Tab은 묶음에서 칩 하나에만 멈춘다. `size` `sm`(기본), `md`(32, 40px). 이름은 `aria-label`이나 보이는 라벨의 `aria-labelledby`로 준다. |
| `Tooltip` | `Tooltip` | `Provider`, `Root`, `Trigger`, `Popup`. Popup은 화면과 반대 색 모드로 그려, 안에 둔 글자가 어떤 색 토큰을 써도 읽힌다. |
| `Popover` | `Popover` | `Root`, `Trigger`, `Popup`(Portal, Positioner, Popup. `anchor`, `side`, `align`, `sideOffset`을 받는다), `Title`, `Close`. 면, 테두리, 그림자만 그리고 안쪽 배치와 폭은 화면이 정한다. |
| `ConfirmPopover` | `Popover` | 되돌리기 어려운 동작 앞의 확인 팝오버. `children`에 `Popover.Trigger`를 두고 `title`, `confirmLabel`, `cancelLabel`(기본 `취소`), `onConfirm`을 받는다. 열리면 취소 버튼에 focus가 가고, `onConfirm`이 Promise면 끝날 때까지 확인 버튼을 막은 뒤 성공하면 닫고 실패하면 열린 채 실패 문구를 보인다. `onOpenChange`의 `details.cancel()`로 열기를 막을 수 있다. |
| `StatusChip` | `span` | tone `neutral`, `success`, `danger`, `warning`(주의), `signal`(진행 중인 일)이고, 모두 글자색 둥근 점과 같은 색의 옅은 면이다. `success` 점은 박자 두 번 주기로 깜박인다. `busy`면 둥근 점 대신 글자색 spinner가 `--animate-spin`으로 돌고, 동작 줄이기에서는 멈춘다. `size` `sm`은 높이 24, `md`는 상단 바 게임 연결 상태의 높이 32다. 상태 변화를 알릴 곳만 `role="status"`를 넘긴다. |
| `Pagination` | `nav`, `Button` | 목록 아래의 `이전`, 현재 페이지 번호, `다음`. `page`, `onPrevious`, `onNext`를 받고, 누를 수 없는 쪽은 `previousDisabled`, `nextDisabled`로 막는다. 전체 페이지 수는 보이지 않는다. 이름은 `aria-label`(기본 `페이지`)이다. |
| `ArrowRightIcon`, `CheckIcon`, `ChevronDownIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `CloseIcon`, `CopyIcon`, `ExternalLinkIcon`, `HeartIcon`, `MinusIcon`, `MonitorIcon`, `MoonIcon`, `PinIcon`, `PlusIcon`, `RefreshIcon`, `SearchIcon`, `SunIcon`, `ViewfinderIcon` | `svg` | 글자색 선 아이콘. 크기는 부모 글자 크기(`1em`)이고, 따로 정할 때는 `size-icon-sm`, `size-icon-md`, `size-icon-lg`만 쓴다. `HeartIcon`, `PinIcon`은 `filled`로 면을 채운다. |

공개 타입은 `className`, `style`을 받지 않는다. 아이콘은 `svg` 속성을 그대로 받아 `className`으로 크기, 색, 배치를 정한다. Base UI 부품 그대로인 `Select.Root`, `Tabs.Root` 같은 부품은 Base UI 문서의 API를 따른다.

Entry는 `@dfragon/ui` 하나다. 앱에서 눈에는 숨기고 보조 기술이 읽게 할 글자는 Tailwind CSS의 `sr-only`를 쓴다.

`@base-ui/react`, React, React DOM은 peer이다. Library build는 이들을 external로 두고 CSS를 출력하지 않는다.

## 소비 앱의 CSS

모든 browser entry는 전역 CSS 하나에서 `tailwindcss/theme.css`, `@dfragon/design/theme.css`, `@dfragon/design/base.css`, `@dfragon/design/components.css`, `tailwindcss/utilities.css` 순서로 한 번 import한다(`apps/web/src/app/site.css`). 앱은 모드 값을 따로 넣지 않으며, 사용자가 고른 모드만 첫 그리기 전에 `html`의 `data-color-mode`로 붙인다.

`apps/web`은 Vite/Vitest의 exact `@dfragon/ui` alias와 TypeScript paths로 public source entry를 직접 해석하므로 library build 없이 source 변경이 반영된다.

## Command

Repository root에서 실행한다.

- `pnpm --filter @dfragon/ui build`: ESM bundle, declaration 생성 뒤 public package export의 소비 검사.
- `pnpm --filter @dfragon/ui verify:build`: 기존 library 산출물의 export, dependency, CSS, 고지, declaration과 Vite 소비 fixture 검사.
- `pnpm --filter @dfragon/storybook dev`: 컴포넌트 옆 `src/*.stories.tsx`를 Storybook에서 본다.
- `pnpm --filter @dfragon/ui test`: typecheck, Vitest interaction, 빌드 검사 도구의 Node 회귀를 차례로 실행한다.
- `pnpm --filter @dfragon/ui exec vitest run test/interaction.test.tsx`: 고른 runtime 테스트만 실행한다. 파일 인수를 aggregate `test`에 넘기지 않는다.
- `pnpm --filter @dfragon/ui typecheck`: src, test를 `tsc --noEmit`으로 검사한다.
- `pnpm --filter @dfragon/ui test:tooling`: 임시 산출물로 빌드 검사 도구를 확인한다. Library 선행 build 없이 실행한다.
- `pnpm --filter @dfragon/ui lint`
- `node packages/ui/scripts/verify-build.mjs library packages/ui/dist`: library 산출물 검사.
- `node packages/ui/scripts/verify-build.mjs consumer <산출물 경로>`: 소비 앱 산출물 검사.
- `node --test packages/ui/scripts/test-consumer-resolution.mjs`: 전용 checkout의 cold consumer command 회귀. 격리 조건은 script 머리 주석에 있다.

## 고지

Library, Web build는 [`@dfragon/licenses`](../licenses/README.md)의 공용 `uiNotices` plugin으로 bundle 입력의 dependency license/NOTICE와 module, chunk 목록을 산출물 `notices`에 기록하며 absolute filesystem path는 남기지 않는다. `@dfragon/ui`에는 외부 source를 복사해 고친 코드가 없어 별도 수정 고지를 두지 않는다.

## 소비 entry와 실제 UI 확인

`apps/web`은 공용 Component와 토큰을 화면에서 직접 쓴다. 공용 UI 변경은 Storybook과 변경한 소비 앱 화면을 브라우저에서 확인한다.
