# @dfragon/design

React와 JavaScript runtime이 없는 디자인 CSS package입니다.

- `theme.css`: 디자인 토큰입니다. Tailwind CSS의 `@theme`이라 Tailwind CSS로 컴파일하는 CSS에서 불러옵니다.
- `base.css`: 글꼴, 색 모드, body 초기화입니다.
- `fonts/`: Pretendard Variable 글꼴 파일입니다. 고지는 `packages/licenses/notices/client`에 있습니다.

앱은 전역 CSS 하나에서 불러옵니다. 순서는 `apps/web/src/site.css`를 따릅니다.

## Command

Repository root에서 실행합니다.

- `pnpm --filter @dfragon/design test`: 토큰 변수 중복, reduced-motion, 색 모드와 Tailwind CSS 컴파일 결과를 검사합니다.
- `pnpm --filter @dfragon/design lint`
