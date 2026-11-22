# DFragon 디자인 시스템

DFragon 웹과 운영 화면이 쓰는 토큰, 글꼴, 컴포넌트 CSS입니다.
원본은 저장소의 `packages/design`이고, 이 시스템은 그 파일을 `pnpm --filter @dfragon/design build:design-system`으로 옮긴 결과입니다.
값은 `theme.css`에서만 고치고 이 페이지에서 고치지 않습니다.

## 원칙

- 화면은 가볍고 깔끔하며 믿음이 가게 그립니다. 장식보다 정렬, 간격, 글자 크기 차이로 위계를 만듭니다.
- 바탕, 글자, 선과 신호색은 무채색입니다. 색은 상황(성공, 경고, 오류), 게임 클라이언트의 색, 차트 계열에만 씁니다.
- 게임 색(레어리티, 강화, 세트 등)은 데이터의 뜻이라 바꾸지 않습니다. 밝은 바탕에서 명암비가 모자란 색만 라이트 값을 따로 둡니다.
- 라이트 모드가 기본이고 다크 모드도 같은 토큰으로 그립니다. 토큰마다 두 모드 값이 함께 있습니다.
- 표와 숫자가 많은 화면이라 밀도를 지킵니다. 숫자는 `font-mono` family로 써서 자릿수를 맞춥니다.

## 토큰 쓰는 법

- 색은 역할 이름(`color-canvas`, `color-fg-muted`)으로 씁니다. 원색 단계(`gray-*`)는 역할 토큰이 참조하는 값이라 화면에서 직접 쓰지 않습니다.
- 면은 `color-canvas` 위에 `color-surface`, `color-inset`, `color-control` 순서로 쌓습니다. 선은 `color-line`, 강한 구분선은 `color-line-strong`, 입력 칸 테두리는 `color-line-input`입니다. 글자는 `color-fg`, 보조는 `color-fg-muted`, 더 흐린 보조는 `color-fg-subtle`입니다.
- 주 버튼, 선택 표시, focus 테두리는 `color-signal`이고 그 위 글자는 `color-on-signal`입니다. 신호색은 한 화면에 적게 씁니다.
- 상태 칩의 면은 `color-*-weak`, 글자는 `color-fg-success`, `color-fg-warning`, `color-fg-danger`입니다.
- 차트는 `color-chart-1`부터 순서대로 쓰고, 기준 항목은 `color-chart-base`입니다. 차트에 게임 색이나 그라데이션을 쓰지 않습니다.
- 간격은 `spacing-0`부터 `spacing-16`까지 아홉 단계(0, 4, 8, 12, 16, 24, 32, 48, 64px)만 씁니다. 버튼과 입력 칸 높이는 `height-control-*`, 상단 바 높이는 `height-topbar`, 표 행 높이는 `height-row`, 표 헤더 높이는 `height-table-head`, 화면 상자 폭은 `container-page`입니다.
- 모서리는 `radius-badge`(배지), `radius-control`(버튼, 입력 칸, 칩), `radius-panel`(고르는 카드)만 씁니다.
- 글자는 `text-*` 단계로 쓰고 줄 높이는 단계에 들어 있습니다. 굵기는 `font-weight-*` 넷만 씁니다.
- 전환은 `ease-standard` 곡선에 `duration-hover`, `duration-state`를 씁니다. 움직임을 줄인 설정에서는 duration이 0이 됩니다.

## CSS로 쓰기

- 저장소 화면은 Tailwind CSS로 `theme.css`를 컴파일합니다. 토큰은 `bg-canvas`, `text-fg-muted`, `border-line` 같은 utility와 `var(--color-canvas)` 같은 CSS 변수로 씁니다.
- 컴포넌트 모양은 디자인 패키지의 컴포넌트 클래스(`btn`, `icon-btn`, `field`, `number-field`, `switch`, `chip`, `badge`, `select`, `listbox`, `tabs`, `tooltip`, `popover`, `confirm-popover`, `status-chip`, `status-spinner`, `page`, `topbar`, `divider-v`, `screen`, `section`, `section-cols`, `section-title`, `screen-head`, `screen-title`, `table`, `num`, `label`, `stat`, `portrait`, `link`, `skeleton`, `state`, `loading-line`, `pagination`)로 쓰고, 화면 배치는 utility나 inline style로 씁니다. 상태는 `disabled`, `aria-pressed`, `data-checked` 같은 속성으로 그립니다.
- 화면은 카드 상자 대신 선으로 구획을 나눕니다. 화면 상자(`screen`) 양옆 세로 선, 구획(`section`) 아래 창 전체 폭 가로 선과 두 선이 만나는 표식이 틀이고, 구획 안의 행과 줄은 좌우 16px에서 글자가 시작합니다. 600px 미만에서는 가로 선만 남습니다.
- 표는 `table` 클래스 하나로 그립니다. 셀은 한 줄로 두고 넘치면 말줄임하며, 이름이 두 줄이 되는 표만 `table-wrap`을 붙입니다. 숫자 칸은 `table-num`, 가로 스크롤 상자는 `table-scroll`, 720px 최소 폭은 `table-wide`입니다.
- Tailwind CSS의 preflight는 쓰지 않습니다. 필요한 초기화는 `base.css`와 각 컴포넌트 클래스가 가집니다.
- 색 모드는 `html`의 `data-color-mode`(`light`, `dark`)가 `color-scheme`을 고정하고, 없으면 시스템 설정을 따릅니다. 이 시스템의 preview에서는 `html`의 `data-theme`도 같은 뜻입니다.

## 캔버스 시안에서 쓰기

- 캔버스 보드는 같은 script가 낸 `out/canvas/dfragon-design.css`를 asset으로 올려 `<link>`로 겁니다. 글꼴은 그 CSS 안에 들어 있습니다.
- 보드의 배치는 inline style로, 색과 컴포넌트 모양은 CSS 변수와 클래스로 씁니다.
- 라이트, 다크는 보드 root의 `color-scheme`으로 바꿉니다.
- CSS가 바뀌면 새로 올리고 보드가 가리키는 주소를 바꿉니다.

## 글꼴

- 본문은 `type.families`의 `sans`(IBM Plex Sans KR), 숫자는 `mono`(Monoplex KR) stack입니다. 굵기마다 파일이 하나씩 있습니다. 글꼴 파일은 `fonts/`에 있고 고지는 저장소의 `packages/licenses/notices/client`에 있습니다.

## 아이콘

- 아이콘은 글자색을 따르는 선 아이콘을 씁니다. 그림 아이콘이나 emoji는 쓰지 않습니다.
