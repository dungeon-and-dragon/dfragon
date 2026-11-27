# 공용 UI

`@dfragon/ui`는 Base UI(`@base-ui/react`) 기반 공용 Component를 제공한다. 동작과 접근성은 Base UI 부품이 맡는다. 외형은 모두 `@dfragon/design/components.css`의 클래스로 그린다. 토큰 값은 `@dfragon/design`에 있다. 제품 data, event, platform 연결은 소비 app이 소유한다.

## Public API

Component 목록은 `src/index.tsx`가, props와 동작은 각 Component 파일과 `src/*.stories.tsx`가 원본이다. `Popover`는 면, 테두리, 그림자만 그리고 안쪽 배치와 폭은 화면이 정한다. 아이콘은 글자색 선 아이콘이고 크기는 부모 글자 크기(`1em`)이며, 따로 정할 때는 `size-icon-sm`, `size-icon-md`, `size-icon-lg`만 쓴다.

공개 타입은 `className`, `style`을 받지 않는다. 아이콘은 `svg` 속성을 그대로 받아 `className`으로 크기, 색, 배치를 정한다. Base UI 부품 그대로인 `Select.Root`, `Tabs.Root` 같은 부품은 Base UI 문서의 API를 따른다.

Entry는 `@dfragon/ui` 하나다.

`@base-ui/react`, React, React DOM은 peer이다. Library build는 이들을 external로 두고 CSS를 출력하지 않는다.

## 소비 앱의 CSS

모든 browser entry는 전역 CSS 하나에서 `tailwindcss/theme.css`, `@dfragon/design/theme.css`, `@dfragon/design/base.css`, `@dfragon/design/components.css`, `tailwindcss/utilities.css` 순서로 한 번 import한다(`apps/web/src/app/site.css`). 앱은 모드 값을 따로 넣지 않으며, 사용자가 고른 모드만 첫 그리기 전에 `html`의 `data-color-mode`로 붙인다.

`apps/web`, `apps/internal`은 Vite/Vitest의 exact `@dfragon/ui` alias와 TypeScript paths로 public source entry를 직접 해석하므로 library build 없이 source 변경이 반영된다.

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

Library, 웹, 운영 화면 build는 [`@dfragon/licenses`](../licenses/README.md)의 공용 `uiNotices` plugin으로 bundle 입력의 dependency license/NOTICE와 module, chunk 목록을 산출물 `notices`에 기록하며 absolute filesystem path는 남기지 않는다. `@dfragon/ui`에는 외부 source를 복사해 고친 코드가 없어 별도 수정 고지를 두지 않는다.

## 소비 entry와 실제 UI 확인

`apps/web`, `apps/internal`은 공용 Component와 토큰을 화면에서 직접 쓴다. 공용 UI 변경은 Storybook과 변경한 소비 앱 화면을 브라우저에서 확인한다.
