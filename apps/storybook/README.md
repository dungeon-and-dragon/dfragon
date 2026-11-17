# Storybook

토큰, 공용 컴포넌트, 패턴, 화면을 실제 코드로 미리 보는 Storybook입니다. 배포하지 않습니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/storybook dev
pnpm --filter @dfragon/storybook test
pnpm --filter @dfragon/storybook lint
pnpm --filter @dfragon/storybook build
```

`dev` 서버는 `http://localhost:6006/`에 뜹니다. toolbar의 색 모드로 `html`의 `data-color-mode`를 라이트와 다크로 바꿉니다. `build`는 typecheck 뒤 정적 Storybook을 `dist`에 만듭니다. `pnpm verify`는 이 앱의 `test`, `build`를 실행합니다.

## 코드 위치

- `.storybook/`: Storybook 설정과 웹 화면과 같은 순서로 불러오는 전역 CSS를 둡니다.
- `src/foundations/`: `packages/design/theme.css`를 읽어 토큰을 그리는 `Foundations` 페이지를 둡니다.
- 컴포넌트 story는 컴포넌트 옆(`packages/ui/src/*.stories.tsx`)에 둡니다.
