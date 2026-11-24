# @dfragon/design

React와 JavaScript runtime이 없는 디자인 CSS package입니다.

- `theme.css`: 디자인 토큰입니다. Tailwind CSS의 `@theme`이라 Tailwind CSS로 컴파일하는 CSS에서 불러옵니다.
- `base.css`: 글꼴, 색 모드, body, button, `dl`, `dd` 초기화입니다.
- `components.css`, `components/`: 컴포넌트 클래스(`btn`, `icon-btn`, `field`, `number-field`, `switch`, `checkbox`, `chip`, `badge`, `select`, `listbox`, `tabs`, `tooltip`, `popover`, `confirm-popover`, `status-chip`, `status-spinner`, `page`, `topbar`, `divider-v`, `screen`, `section`, `section-cols`, `section-title`, `screen-head`, `screen-title`, `table`, `num`, `label`, `stat`, `portrait`, `link`, `skeleton`, `state`, `loading-line`, `pagination`)입니다. 상태는 Base UI가 붙이는 `data-*` 속성과 pseudo-class로 그려 HTML에 클래스와 속성만 적어도 같은 모양입니다. 앱 전역 CSS가 `components` layer로 불러옵니다.
- `fonts/`: IBM Plex Sans KR과 Monoplex KR 글꼴 파일입니다. 굵기(400, 500, 600, 700)마다 파일이 하나씩 있습니다. 고지는 `packages/licenses/notices/client`에 있습니다.
- `design-system/`: Design System artifact의 README와 preview 원본입니다. `components/<이름>.css`를 더하면 `design-system/previews/<이름>.html`도 함께 둡니다.

토큰 값의 원본은 `theme.css`입니다. 코드 뒤에는 `apps/storybook`의 `Foundations` 페이지에서 봅니다.

앱은 전역 CSS 하나에서 불러옵니다. 순서는 `apps/web/src/app/site.css`를 따릅니다.

## Command

Repository root에서 실행합니다.

- `pnpm --filter @dfragon/design test`: 토큰 변수 중복, reduced-motion, 색 모드와 Tailwind CSS 컴파일 결과를 검사하고, 컴포넌트 CSS가 `theme.css`의 변수만 읽는지 검사합니다.
- `pnpm --filter @dfragon/design lint`
- `pnpm --filter @dfragon/design build:design-system`: `out/design-system/project`에 Design System artifact 파일을, `out/canvas/dfragon-design.css`에 캔버스 보드용 CSS를 냅니다.
