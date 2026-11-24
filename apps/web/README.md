# Web

DFragon 웹 앱입니다. Node 서버가 전역 틀을 서버에서 그려 내주고 화면은 브라우저에서 그립니다. `dfragon.com`에 올리며, 설치 없이 캐릭터와 모험단을 찾고 멀티서치에서 닉네임 검색, 스크린샷 붙여넣기, 화면 공유로 파티, 공대를 확인합니다. 데스크톱 브라우저용입니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/web dev
pnpm --filter @dfragon/web test
pnpm --filter @dfragon/web lint
pnpm --filter @dfragon/web build
pnpm --filter @dfragon/web preview
```

`build`는 `tsc -b`와 Vite production build를 포함하므로 `typecheck`를 따로 실행할 필요가 없습니다. `pnpm verify`는 Web의 `test`, `build`를 실행합니다. 산출물은 `.output`에 생기며, `.output/server/index.mjs`가 서버이고 `.output/public`이 정적 파일입니다.

`dev`와 `build`는 먼저 [`prepare-ocr-assets.mjs`](scripts/prepare-ocr-assets.mjs)로 OCR 모델과 ONNX Runtime WASM을 `public/ocr`에 만듭니다(Git에서 제외). 처음 checkout할 때 [`@dfragon/models` 받기](../../packages/models/README.md#받기)의 `ocr-finetuned` submodule을 받아야 하며, 받지 않으면 두 명령이 실패합니다.

`dev` 서버(`http://localhost:5173/`)는 `/api/*` 요청을 `/api`를 뗀 경로로 운영 API(`https://api.dfragon.com`)에 넘기므로 로컬 API, Neople key 없이 검색해 볼 수 있습니다. `preview`는 빌드한 서버를 띄우며 이 proxy가 없어 검색이 되지 않습니다. `dev` 서버는 첫 붙여넣기에서 `onnxruntime-web/webgpu`를 최적화하며 페이지를 한 번 다시 읽으므로 그때는 다시 붙여 넣습니다.

스킬 탭과 서약 탭은 `/skilltab/` 데이터 묶음이 있어야 그림으로 그립니다. 개발 서버에서는 `DFRAGON_SKILLTAB_DIR`에 묶음 폴더를 주면 `/skilltab/` 아래에 내줍니다. 묶음 형식은 [스킬 창 schema](src/entities/catalog/model/skill-window.ts)와 [서약 schema](src/entities/catalog/model/oath-catalog.ts)에 있습니다.

## 배포

운영자가 고른 main commit을 인프라의 빌드 노드가 빌드해 운영 `https://dfragon.com`(`web`)과 dev `https://dev.dfragon.com`(`web-dev`)에 배포합니다(ADR 0029). 절차는 [인프라 fleet 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/fleet/README.md#배포)에 있습니다([서버 이미지](../api/README.md#서버-이미지)). main merge는 이미지를 빌드하거나 배포하지 않습니다. PR 미리보기는 없으며, PR의 화면은 로컬 `dev` 서버나 `build` 뒤 `preview`로 확인합니다.

### 웹 이미지

[`Dockerfile`](Dockerfile)이 `.output`을 Node로 띄우는 이미지를 만듭니다. 서버는 `PORT`(기본 8080)에서 듣고, 서버 렌더링이 부를 API 주소를 `DFRAGON_API_ORIGIN`으로 받습니다. 서버 process 수는 `NITRO_CLUSTER_WORKERS`(이미지 기본 1)로 받습니다. 응답 헤더(cross-origin isolation, 캐시)와 화면 HTML 캐시는 [`vite.config.ts`](vite.config.ts)의 route rule이 정합니다. 빌드에는 `ocr-finetuned` submodule이 있어야 합니다. 빌드한 commit은 `SOURCE_COMMIT` 빌드 인자로 받으며, 없으면 화면에 `dev`를 보입니다. 저장소 root에서 배포와 같은 제약으로 띄워 확인합니다.

```sh
podman build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/web/Dockerfile -t dfragon-web:local .
podman run --rm --read-only --user 1000:1000 --cap-drop ALL --tmpfs /tmp -e DFRAGON_API_ORIGIN=https://api.dfragon.com -p 8080:8080 dfragon-web:local
```

## 코드 위치

`src`는 Feature-Sliced Design 계층 폴더와 `testing/`로 나뉩니다.
파일은 자기보다 아래 계층만 import하며, 규칙은 웹 lint(dependency-cruiser)가 검사합니다.

- `src/app/`: 진입 파일, 라우터, 조회 캐시 설정과 전역 CSS를 둡니다.
- `src/pages/<화면>/`: 라우트 화면과 그 화면만 쓰는 코드를 둡니다. 라우트나 다른 화면이 그리는 진입 컴포넌트는 `*Page.tsx`, 화면 본체는 `*Screen.tsx`입니다.
- `src/widgets/<이름>/`: 두 화면 이상이나 app이 쓰는 큰 화면 조각을 둡니다.
- `src/features/<이름>/`: 두 화면 이상이나 app이 쓰는 사용자 동작을 둡니다.
- `src/entities/<도메인>/`: 두 슬라이스 이상이 쓰는 schema, 타입, 표시 함수와 조회를 둡니다.
- `src/shared/`: `ui`, `api`, `lib`, `config`, `assets`처럼 도메인을 모르는 코드를 둡니다.
- `src/testing/`: Vitest setup, router와 query client 테스트 도구, story 틀을 둡니다. handler가 없는 API 요청을 보낸 테스트는 실패합니다.
- `public/data/event-rewards.v1.json`: 공식 이벤트의 보상과 획득 조건을 옮긴 데이터 파일입니다. 형식은 [이벤트 보상 schema](src/entities/catalog/model/event-rewards.ts)에 있습니다.

pages, widgets, features, entities는 슬라이스로 나누고, 같은 계층의 다른 슬라이스는 import하지 않습니다.
슬라이스 안은 `ui`(컴포넌트), `api`(요청과 query hook, fixture, MSW handler), `model`(store와 React hook, schema와 타입), `lib`(React를 쓰지 않는 계산과 판정) 세그먼트로 나눕니다.

- **alias**: 자기 폴더 밖은 `#app/...`, `#pages/...`, `#widgets/...`, `#features/...`, `#entities/...`, `#shared/...`, `#testing/...`로 가져오고, 같은 폴더는 `./...`로 가져옵니다.
- **슬라이스 index**: 슬라이스 밖에서는 `#<계층>/<슬라이스>`로 그 슬라이스의 `index.ts`만 가져옵니다. 같은 슬라이스의 다른 세그먼트는 `#features/capture-search/lib/capture/cards`처럼 파일까지 적습니다. `shared`는 슬라이스가 없어 `#shared/<세그먼트>/...`로 파일을 가져옵니다.
- **`@x`**: 다른 entity에서 쓰는 이름은 제공하는 슬라이스의 `@x/<쓰는 슬라이스>.ts`에서 다시 내보냅니다.
- **테스트 코드**: fixture(`api/*.fixture.ts`)와 MSW handler(`api/*.handlers.ts`), `testing/`은 테스트, story, 다른 fixture와 handler에서만 import합니다. 테스트 코드는 다른 슬라이스의 fixture와 handler를 파일로 가져올 수 있습니다.
- **React 금지**: `src/features/capture-search/lib/`은 화면 캡처, OCR worker, 검색 로직이라 React, `react-dom`, `@dfragon/ui`를 import하지 않습니다.

## 글꼴과 고지

서드파티 고지는 화면에 링크하지 않고 빌드 산출물의 `notices`에 둡니다. 배포하면 `https://dfragon.com/notices/` 아래에서 볼 수 있습니다.

- `notices/THIRD-PARTY.txt`: 번들 입력 package의 license와 NOTICE
- `notices/client/`: 글꼴(IBM Plex Sans KR, Monoplex KR)과 Lucide 아이콘 고지
- `notices/site/NOTICE.md`: Neople Open API 로고(컬러, 회색)의 출처, 권리([원본](NOTICE.md))
- `ocr/`: OCR 모델과 ONNX Runtime의 license, NOTICE
