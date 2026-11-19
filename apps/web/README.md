# Web

DFragon 웹 앱 정적 사이트입니다. `dfragon.com`에 올리며, 설치 없이 캐릭터와 모험단을 찾고 멀티서치에서 닉네임 검색, 스크린샷 붙여넣기, 화면 공유로 파티, 공대를 확인합니다. 데스크톱 브라우저용입니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/web dev
pnpm --filter @dfragon/web test
pnpm --filter @dfragon/web lint
pnpm --filter @dfragon/web build
pnpm --filter @dfragon/web preview
```

`build`는 `tsc -b`와 Vite production build를 포함하므로 `typecheck`를 따로 실행할 필요가 없습니다. `pnpm verify`는 Web의 `test`, `build`를 실행합니다. 산출물은 `dist`에 생깁니다.

`dev`와 `build`는 먼저 [`prepare-ocr-assets.mjs`](scripts/prepare-ocr-assets.mjs)로 OCR 모델과 ONNX Runtime WASM을 `public/ocr`에 만듭니다(Git에서 제외). 처음 checkout할 때 [`@dfragon/models` 받기](../../packages/models/README.md#받기)의 `ocr-finetuned` submodule을 받아야 하며, 받지 않으면 두 명령이 실패합니다.

`dev` 서버(`http://localhost:5173/`)는 `/api/*` 요청을 `/api`를 뗀 경로로 운영 API(`https://api.dfragon.com`)에 넘기므로 로컬 API, Neople key 없이 검색해 볼 수 있습니다. `preview`에는 이 proxy가 없어 검색이 되지 않습니다. `dev` 서버는 첫 붙여넣기에서 `onnxruntime-web/webgpu`를 최적화하며 페이지를 한 번 다시 읽으므로 그때는 다시 붙여 넣습니다.

스킬 탭과 서약 탭은 `/skilltab/` 데이터 묶음이 있어야 그림으로 그립니다. 개발 서버에서는 `DFRAGON_SKILLTAB_DIR`에 묶음 폴더를 주면 `/skilltab/` 아래에 내줍니다. 묶음 형식은 [스킬 창 schema](src/core/catalog/skill-window.ts)와 [서약 schema](src/core/catalog/oath-catalog.ts)에 있습니다.

## 배포

운영자가 고른 main commit을 인프라의 빌드 노드가 빌드해 운영 `https://dfragon.com`(`web`)과 dev `https://dev.dfragon.com`(`web-dev`)에 배포합니다(ADR 0029). 절차는 [인프라 fleet 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/fleet/README.md#배포)에 있습니다([서버 이미지](../api/README.md#서버-이미지)). main merge는 이미지를 빌드하거나 배포하지 않습니다. PR 미리보기는 없으며, PR의 화면은 로컬 `dev` 서버나 `build` 뒤 `preview`로 확인합니다.

### 웹 이미지

[`Dockerfile`](Dockerfile)이 `dist`를 [`Caddyfile`](Caddyfile)의 Caddy가 내주는 이미지로 만듭니다. 빌드에는 `ocr-finetuned` submodule이 있어야 합니다. 빌드한 commit은 `SOURCE_COMMIT` 빌드 인자로 받으며, 없으면 화면에 `dev`를 보입니다. 저장소 root에서 배포와 같은 제약으로 띄워 확인합니다.

```sh
podman build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/web/Dockerfile -t dfragon-web:local .
podman run --rm --read-only --user 1000:1000 --cap-drop ALL --tmpfs /tmp -p 8080:8080 dfragon-web:local
```

## 코드 위치

자기 폴더 밖의 source는 `#<폴더>/...` alias로 가져오고, 같은 폴더 안에서는 `./...`를 씁니다.
화면 폴더 밖에서는 `#pages/<화면>`, core 밖에서는 `#core/<도메인>`으로 가져오며, 같은 화면 안과 core 도메인 사이는 파일까지 적습니다.

웹은 Feature-Sliced Design 계층으로 옮기는 중입니다.
계층은 위에서부터 `app`, `pages`, `widgets`, `features`, `entities`, `shared`이고, 파일은 자기보다 아래 계층만 import합니다.
같은 계층의 다른 슬라이스는 import하지 않고, 슬라이스 밖에서는 `#<계층>/<슬라이스>`로 그 슬라이스의 `index.ts`를 가져옵니다.
`shared`는 `#shared/<세그먼트>/...`로 파일을 직접 가져오고, 옛 폴더(`components`, `hooks`, `core`, `host`, `lib`)를 import하지 않습니다.

- `public/data/event-rewards.v1.json`: 공식 이벤트의 보상과 획득 조건을 옮긴 데이터 파일을 두는 위치입니다. 형식은 [이벤트 보상 schema](src/core/catalog/event-rewards.ts)에 있습니다.
- `src/WebApp.tsx`: 웹 라우터를 둡니다.
- `src/components/`: 두 화면 이상이나 웹 앱 전역에서 쓰는 컴포넌트와 스타일을 둡니다.
- `src/core/`: React와 UI 폴더를 import하지 않는 검색, 캡처, OCR 로직을 둡니다.
- `src/core/<도메인>/index.ts`: core 밖에서 `#core/<도메인>`으로 가져오는 이름을 다시 내보냅니다. core 안의 도메인 사이는 파일을 직접 가져옵니다.
- `src/hooks/`: 두 화면 이상이나 웹 앱 전역에서 쓰는 React hook과 store를 둡니다.
- `src/host/`: 브라우저 API를 검색, 캡처, 클립보드 기능과 연결합니다.
- `src/lib/`: 조회 캐시와 카드 표시, 저장된 캐릭터 처리 함수를 둡니다.
- `src/pages/<화면>/`: 라우트나 다른 화면이 렌더링하는 진입 컴포넌트인 `*Page.tsx`와 화면 본체인 `*Screen.tsx`를 둡니다. 한 파일 화면은 `*Page.tsx`에 본체도 둡니다.
- `src/pages/<화면>/index.ts`: 그 화면의 `*Page.tsx`, `*Screen.tsx` 컴포넌트와 화면 폴더 밖에서 가져오는 함수, 상수를 다시 내보냅니다. 외부 import에는 `#pages/<화면>`처럼 폴더 이름까지만 적습니다.
- `src/pages/<화면>/components/`: 그 화면만 쓰는 컴포넌트와 스타일, 테스트를 둡니다.
- `src/pages/<화면>/hooks/`: 그 화면만 쓰는 React hook과 store, 테스트를 둡니다.
- `src/pages/<화면>/animations/`: 그 화면의 GSAP animation hook을 둡니다.
- `src/testing/`: UI 테스트 setup, fixture와 host, router, MSW 서버 테스트 도구를 둡니다. handler가 없는 API 요청을 보낸 테스트는 실패합니다.
- `src/core/adventure-guild/`: 모험단 정보, 주간 기록, 활동 응답 schema를 둡니다.
- `src/core/api/`: DFragon API 요청 함수와 응답 schema, API 오류 코드를 둡니다.
- `src/core/capture/`: 캡처 회차, 슬롯, 자리와 캡처한 카드의 표시 함수, 검색 상태를 둡니다.
- `src/core/capture/party/`: 파티 화면 인식과 파티 캡처 machine을 둡니다.
- `src/core/capture/raid/`: 공대 상세 창 검출, 행 인식, 공대 캡처 machine과 기준 이미지를 둡니다.
- `src/core/catalog/`: 스킬 창, 서약, 게임 문구 데이터 묶음과 이벤트 보상 데이터 파일의 schema를 둡니다.
- `src/core/character/`: 캐릭터 상세, 장비, 서약, 점수 표시 함수와 캐릭터 타입을 둡니다. 검색, 캡처, OCR 코드는 import하지 않습니다.
- `src/core/ocr/`: OCR worker, 닉네임 이미지 처리와 인식 결과 선택을 둡니다.
- `src/core/ranking/`: 명성 랭킹, 캐릭터 통계, 스킬 통계 응답 schema를 둡니다.
- `src/core/search/`: 캐릭터 검색 요청, 식별, 초상화 비교와 검색 상태를 둡니다.
- `src/core/testing/`: core와 UI 테스트가 함께 쓰는 fixture를 둡니다.
- `src/core/today-grade/`: 오늘 등급 타입과 희귀도 구분을 둡니다.
- `src/app/`, `src/widgets/`, `src/features/`, `src/entities/`: FSD 계층 폴더입니다. 옛 폴더의 코드를 옮기면서 채웁니다.
- `src/entities/ranking/api/`: 명성 랭킹 요청과 query hook, 테스트와 story가 쓰는 fixture(`*.fixture.ts`)와 MSW handler(`*.handlers.ts`)를 둡니다. fixture와 handler는 테스트와 story에서만 import합니다.
- `src/shared/api/`: API 주소(같은 origin의 `/api`)와 공용 ky instance를 둡니다.
- `src/shared/ui/`: 차트, 목록 상자, 제목 상자, 로딩 줄, tooltip, 복사 버튼처럼 도메인을 모르는 컴포넌트와 그 animation hook을 둡니다.
- `src/shared/lib/`: 조회 결과, 클립보드 복사 hook과 시간 표시 함수, 브라우저 console 진단 코드를 둡니다.
- `src/shared/lib/animations/`: GSAP 설정과 공용 전환 animation hook을 둡니다.
- `src/shared/config/`: 서버 이름, 서버 ID 타입과 서버 선택지 상수를 둡니다.
- `src/shared/assets/`: 로고, 시즌 배경과 클리어 집계 배경 이미지를 둡니다.

## 글꼴과 고지

서드파티 고지는 화면에 링크하지 않고 빌드 산출물의 `notices`에 둡니다. 배포하면 `https://dfragon.com/notices/` 아래에서 볼 수 있습니다.

- `notices/THIRD-PARTY.txt`: 번들 입력 package의 license와 NOTICE
- `notices/client/`: 글꼴(IBM Plex Sans KR, Monoplex KR)과 Lucide 아이콘 고지
- `notices/site/NOTICE.md`: Neople Open API 로고(컬러, 회색)의 출처, 권리([원본](NOTICE.md))
- `ocr/`: OCR 모델과 ONNX Runtime의 license, NOTICE
