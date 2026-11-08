# Web

던삐삐 웹 앱 정적 사이트입니다. `dfragon.com`에 올리며, 메인 화면의 큰 검색창으로 캐릭터와 모험단을 찾고, 멀티서치에서 설치 없이 닉네임 검색, 스크린샷 붙여넣기, 화면 공유로 파티, 공대를 확인합니다. 화면마다 주소가 있으며 지금은 `/`(메인 화면), `/multisearch`(파티, 공대 표), `/c/<serverId>/<characterId>`(캐릭터 상세), `/terms`(이용약관), `/privacy`(개인정보처리방침), 없는 주소 안내가 있습니다. 모든 화면은 위쪽의 전역 바, 그 아래 폭 1080px 화면 상자, 페이지 아래 가운데의 한 줄 푸터(86×24 회색 Neople Open API 로고, `이용약관`, `개인정보처리방침`), 페이지 왼쪽 아래의 빌드 commit 7자리로 되어 있고 배경 그림, 소개 문구는 없습니다. `이용약관`, `개인정보처리방침`은 두 약관 화면으로 가는 링크이고, 지금 화면의 링크는 현재 위치로 알립니다. 두 약관 화면은 제목 줄과 빈 본문 박스만 있습니다. 데스크톱 브라우저용이며 휴대폰은 지원하지 않습니다. 분석, 쿠키, 로그인이 없습니다. 즐겨찾기와 최근 본 캐릭터는 브라우저의 localStorage에만 저장하고 서버로 보내지 않습니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/web dev
pnpm --filter @dfragon/web test
pnpm --filter @dfragon/web lint
pnpm --filter @dfragon/web build
pnpm --filter @dfragon/web preview
```

`build`는 `tsc -b`와 Vite production build를 포함하므로 같은 변경을 검증할 때 `typecheck`를 다시 실행할 필요는 없습니다. `pnpm verify`는 Web의 `test`, `build`를 실행합니다. 산출물은 `dist`에 생깁니다.

`dev`와 `build`는 먼저 `prepare:ocr-assets`로 [`prepare-ocr-assets.mjs`](scripts/prepare-ocr-assets.mjs)에 출력 폴더를 넘겨 실행해 OCR 모델과 ONNX Runtime WASM을 `public/ocr`에 만듭니다. 이 폴더는 Git에서 제외합니다. 파인튜닝 모델을 쓰므로 처음 checkout할 때 [`@dfragon/models` 받기](../../packages/models/README.md#받기)의 `ocr-finetuned` submodule을 받아야 하며, 받지 않으면 두 명령이 실패합니다.

`dev` 서버(`http://localhost:5173/`)는 같은 origin의 `/api/*` 요청을 `/api`를 뗀 경로로 운영 API(`https://api.dfragon.com`)에 넘기므로 로컬 API, Neople key 없이 멀티서치에서 닉네임 검색을 해 볼 수 있습니다. production build(`build`, `preview`)도 같은 origin의 `/api`를 부르지만 `preview`에는 proxy가 없으므로, 검색은 `/api/*`를 API로 넘기는 서버(node1의 host Caddy)에 올려야 됩니다.

멀티서치에 던파 창의 스크린샷(Alt+PrtSc)을 Ctrl+V로 붙여 넣으면 지금 화면(파티, 공대)의 인식 회차가 시작됩니다. 다른 주소의 화면에서 붙여 넣은 이미지는 회차를 시작하지 않고 버립니다. 첫 붙여넣기 때 `/ocr`의 모델과 WASM을 받습니다. `dev` 서버는 첫 붙여넣기에서 `onnxruntime-web/webgpu`를 처음 최적화하며 페이지를 한 번 다시 읽으므로, 그때는 다시 붙여 넣습니다.

멀티서치 게임 바의 캡처 도구 왼쪽에 있는 "화면 공유" 버튼(연결 뒤에는 "게임 연결됨" 칩)을 누르면 브라우저의 화면 공유 창이 열립니다. 던파 창을 공유한 뒤 캡처 버튼을 누르면 공유 화면에서 한 장을 읽어 지금 화면의 회차를 시작합니다. 브라우저의 공유 중지를 누르면 칩이 연결 전으로 돌아갑니다. 다른 주소의 화면에 다녀와도 공유 연결은 남고, 다른 화면을 보는 동안 공유를 멈추면 돌아왔을 때 연결 전입니다. 화면 공유는 `localhost`나 HTTPS 페이지에서만 열립니다.

던파 창을 공유한 동안에는 약 1초마다 공유 화면을 보고, 게임이 마을에 있을 때 지금 화면의 구성이 바뀌면 그 화면의 회차를 자동으로 시작합니다. 파티 화면이면 게임의 파티 프레임만, 공대 화면이면 공대 상세 창만 보며, 자동 인식은 화면(파티, 공대)을 바꾸지 않습니다. 구성이 같으면 회차를 시작하지 않으므로 같은 구성을 다시 읽으려면 캡처 버튼을 누릅니다. 자동 인식 회차도 멀티서치를 보는 동안에만 시작합니다.

캐릭터 상세의 스킬 탭은 데이터 묶음이 있어야 스킬 창 배치로 그립니다. 웹 앱은 같은 origin의 `/skilltab/skilltab.v3.json` index를 한 번 받고, index가 가리키는 그 캐릭터 직업의 파일(`<판>/jobs/<jobId>.<내용 hash>.json`)만 받습니다. 버프 강화 탭의 버프 스킬 아이콘도 같은 직업 파일을 씁니다. index가 404거나 index에 그 직업이 없으면 직업 파일을 받지 않고 배운 스킬을 습득 레벨 줄로 나눈 목록으로 보이며, 묶음에 없는 전직과 직업 파일을 받지 못했을 때도 같은 목록으로 보입니다. 스킬 창 배치로 그릴 때는 그 전직의 스킬 채택률을 API `GET /stats/skills`에서 한 번 받아 스킬 아이콘 Tooltip에 채택률, 레벨 분포, 개화와 강화 비율, 표본 수와 기준 시각을 더합니다. 남성 크루세이더(프리스트(남) 眞 크루세이더)는 카드 역할을 `role`로 함께 보내 같은 역할의 표본만 받고, 표본 수 앞에 `딜러`, `버퍼`를 쓰며, 딜러 판정 스킬인 `용기의 은총`의 Tooltip은 스킬 이름 한 줄입니다. 표본이 20명보다 적거나, 받는 중이거나, 받지 못했으면 Tooltip은 스킬 이름 한 줄입니다. 서약 탭의 세트 아이콘과 선택지 효과 카드는 `/skilltab/oath.v2.json`에서 받으며, 404면 지금의 서약 한 줄로 보입니다.

데이터 묶음의 형식은 [스킬 창 schema](src/core/catalog/skill-window.ts)와 [서약 schema](src/core/catalog/oath-catalog.ts)에 정의합니다. 개발 서버에서는 `DFRAGON_SKILLTAB_DIR`에 데이터 묶음 폴더를 주면 `/skilltab/` 아래에 내줍니다.

## 배포

node1이 사이트를 공인 IP로 직접 내줍니다(ADR 0029). [`Dockerfile`](Dockerfile)이 `dist`를 Caddy가 내주는 이미지로 만들고, 운영 `https://dfragon.com`과 dev `https://dev.dfragon.com`은 같은 이미지를 각각 node1의 `web`, `web-dev` 컨테이너로 띄웁니다. 그 앞의 host Caddy가 TLS, `www.dfragon.com`에서 `https://dfragon.com`으로의 301 리디렉션, `/api/*`(`/api`를 뗀 경로로 API에 넘김), `/skilltab/*`과 dev의 `robots.txt`(`Disallow: /`)를 맡습니다. 컨테이너와 host Caddy 설정은 dfragon-infra 저장소에 있습니다.

- dev, 운영 배포: node1이 운영자가 고른 main commit을 빌드해 `web-dev`, `web`에 각각 배포하며 절차는 [인프라 운영 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/deploy/linux/README.md)에 있습니다([서버 이미지](../api/README.md#서버-이미지)). main merge는 이미지를 빌드하거나 배포하지 않습니다. 운영 배포 시점은 저장소 소유자가 정합니다.
- PR 미리보기: 없습니다. PR의 화면은 로컬 `dev` 서버나 `build` 뒤 `preview`로 확인하고, merge 뒤에는 dev에 배포해 `https://dev.dfragon.com`에서 확인합니다.

빌드는 `ocr-finetuned` submodule이 있어야 하며 OCR 자산(`/ocr/`)을 이미지에 그대로 넣습니다. OCR 모델과 WASM은 첫 붙여넣기나 첫 화면 공유 때 받으므로 닉네임 검색만 하는 방문자는 받지 않습니다.

### 웹 이미지

[`Caddyfile`](Caddyfile)은 모든 응답에 `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`를 붙여 페이지와 OCR worker를 cross-origin 격리하므로 OCR의 ONNX Runtime WASM이 여러 thread로 돕니다. `/assets/*`의 파일은 1년 동안 캐시하며, `/ocr/*`와 나머지 파일은 `Cache-Control: no-cache`와 ETag로 매번 확인합니다. 파일이 없는 주소는 `index.html`을 돌려주지만 `/assets/*`, `/ocr/*`에 없는 파일은 404입니다.

배포 helper는 컨테이너를 `1000:1000` 사용자, 읽기 전용 root, capability 없음, tmpfs `/tmp`로 띄웁니다. 그래서 Caddy는 admin endpoint를 끄고 `:8080`에서 받으며 설정, 데이터 폴더를 `/tmp`에 둡니다. 빌드한 commit은 `SOURCE_COMMIT` 빌드 인자로 받아 `/app/build-info.json`에 기록하고, Vite 빌드가 앞 7자리를 화면 왼쪽 아래에 박습니다. `SOURCE_COMMIT`이 없거나 비었으면 `dev` 서버와 빌드 모두 `dev`를 보입니다. 저장소 root에서 같은 제약으로 띄워 확인합니다.

```sh
docker build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/web/Dockerfile -t dfragon-web:local .
docker run --rm --read-only --user 1000:1000 --cap-drop ALL --tmpfs /tmp -p 8080:8080 dfragon-web:local
```

### 스킬 창, 서약 데이터

dev와 운영은 같은 `/skilltab/` 데이터 묶음 폴더를 씁니다. `skilltab.v3.json`과 `oath.v2.json`은 `Cache-Control: no-cache`와 ETag로 매번 확인하고, 이름에 내용 hash가 있는 직업 파일과 그림은 1년 동안 캐시합니다.

## 구성

- `index.html`: 제목, 설명, OG 메타 태그. OG 이미지는 두지 않아 링크 미리보기는 제목과 설명만 보입니다(2026-10-31 결정, [Issue #1036](https://github.com/dungeon-and-dragon/dfragon/issues/1036)).
- `src/App.tsx`: 위에서 시작하는 페이지에 웹 앱을 그리고 왼쪽 아래에 빌드 commit을 놓습니다. 페이지는 창 높이를 채웁니다. 웹 앱을 받는 동안에는 빈 전역 바만 둡니다. 푸터는 약관 링크가 화면을 다시 읽지 않고 옮겨 가도록 웹 앱의 라우터 안에서 화면 상자 아래 가운데에 그리며, 내용이 길면 내용 아래로 밀립니다.
- 웹 앱: `src/WebClient.tsx`가 모듈을 읽을 때 한 번 `installBrowserHost`를 부르고(API 주소는 같은 origin의 `/api`), `App.tsx`가 이 모듈을 나중에 받아 첫 화면에 그립니다. [`installBrowserHost`](src/host/index.ts)는 전역을 붙이지 않고 검색, 캡처, 등급 연산을 담은 host를 돌려주며 페이지의 붙여넣기(`paste`)를 받습니다. 이 host를 `WebApp`에 넘기면 React context로 화면에 전달됩니다. 붙여 넣은 이미지와 공유 화면의 프레임은 `createImageBitmap`과 WebGL로 읽고, 공대 템플릿 PNG도 같은 디코더로 받습니다. `src/WebClient.tsx`가 `src/host/`와 `src/WebApp.tsx`를 직접 import하고, Vite가 웹 앱의 source를 번들합니다.
- 주소와 화면: `WebApp`이 TanStack Router(`@tanstack/react-router`)로 `/`에 메인 화면을, `/multisearch`에 파티, 공대 표를, `/c/<serverId>/<characterId>`에 캐릭터 상세(상단 요약과 장비, 서약, 스킬, 아바타, 버프 강화, 스탯, 타임라인 탭)를, 그 밖의 주소에 없는 주소 화면(열려던 주소, "없는 주소입니다.", 메인 화면으로 가는 "첫 화면으로" 링크)을 그립니다. 메인 화면은 화면 상자 안 첫 박스(전역 바 면 색)에 640×48 큰 검색창 하나만 두고, 그 아래 가운데에 같은 폭의 "명성 랭킹" 박스를 둡니다. 박스는 랭킹 화면의 직업 전체 조회(캐시 공유)로 앞 3명을 같은 표 부품에 순위, 캐릭터, 명성 열로 그립니다. 큰 검색창은 이름 칸이 비어 있을 때 초점을 받으면 "최근 본 캐릭터"와 "즐겨찾기" 절을 절마다 최대 5줄씩 드롭다운으로 엽니다. 큰 검색창은 전역 바의 캐릭터 검색창과 같은 컴포넌트의 큰 크기이므로 검색 대상, 이름 칸, 검색 버튼과 제출 흐름이 같습니다. 블록은 `src/pages/home/`에 블록마다 컴포넌트 하나로 둡니다. 캐릭터 상세는 고른 탭을 search param `tab`에 두고, 탭을 바꾸면 다시 조회하지 않고 지금 기록의 주소만 바꿉니다. 타임라인 탭은 상세 응답에 없어 탭을 처음 열 때 API의 `/characters/<serverId>/<characterId>/timeline`을 따로 조회합니다. 조회가 실패하면 다음에 탭을 열 때 다시 조회합니다. 웹 이미지의 Caddy는 없는 파일 주소에 `index.html`을 돌려주고 개발 서버도 같으므로, 주소창에 어느 주소를 직접 열어도 사이트가 뜹니다. 새 화면은 그 기능이 주소를 등록하며 더합니다.
- 조회 캐시: 캐릭터 상세, 타임라인, 이름 검색, 길드, 명성 순위, 통계, 모험단의 시즌 활동, 하루 활동 상세와 주간 던파는 TanStack Query(`@tanstack/react-query`)로 받은 값을 5분 동안 브라우저 메모리에 둡니다. 5분 안에 같은 화면이나 탭을 다시 열면 조회하지 않고 받아 둔 값을 그립니다. 받은 지 5분이 지났는데 화면을 떠난 지 5분이 지나지 않았다면 받아 둔 값을 먼저 그리고 다시 조회해 바꿉니다. 실패한 조회는 다시 시도하지 않습니다. 받아 둔 값이 없으면 오류를 보이고 다음에 그 화면을 열 때 다시 조회하며, 받아 둔 값이 있으면 그 값을 계속 보입니다. 모험단 화면의 새로고침은 그 모험단의 시즌 활동, 하루 활동 상세와 주간 던파 캐시를 버리고 받는 중부터 다시 그립니다. 모험단 화면은 고른 시즌을 search param `season`에 두고, 시즌을 바꾸는 동안 시즌 타임라인은 앞서 받은 응답으로 그대로 그립니다. 옛 시즌 막대를 눌러 그 시즌을 받는 동안에는 시즌 활동을 3초마다 다시 조회해 막대의 채운 길이를 바꾸고, 다 받거나 멈추면 조회를 멈춥니다. 히트맵 칸의 하루 활동 상세는 그 칸에 처음 마우스를 올릴 때 받습니다. 오늘 등급은 API가 준 만료 시각에 다시 받으므로 이 캐시를 쓰지 않습니다. 페이지를 다시 읽으면 캐시가 사라집니다.
- 전역 바: 모든 화면 위에 화면 전체 폭으로 펴고, 안쪽 내용은 가운데 1080px 열에 둡니다. 왼쪽부터 브랜드(누르면 `/`), 전역 메뉴, 캐릭터 검색창(메인 화면에서는 숨김), 오늘 등급, 오른쪽 끝의 모드 전환 버튼입니다. 오늘 등급은 라벨 글자 없이 퍼센트만 보이고, 보조 기술에는 "오늘 등급 N퍼센트"와 희귀도 이름으로 알립니다. 메뉴는 `멀티서치`, `랭킹`, `통계`, `모험단`, `즐겨찾기` 순서이고 지금 화면의 항목을 굵은 글자와 신호색 밑줄로 표시하며, 메인 화면처럼 메뉴에 없는 화면에서는 밑줄을 숨깁니다. `모험단`은 `/adventures`로 가며, 브라우저에 저장한 모험단이 있으면 `/adventures/<모험단 이름>`으로 바꾸고 없으면 모험단 이름 입력 화면을 보입니다. 예전 주소 `/my`는 `season`과 함께 `/adventures`로 넘깁니다. 검색창은 서버(기본 전체)와 이름으로 이름이 정확히 같은 캐릭터를 찾아, 한 명이면 바로 그 캐릭터의 상세로 가고 여러 명이면 아래 목록(명성 순)에서 고르며 없으면 찾지 못했다는 문구를 보입니다. 목록이 열려도 초점은 이름 칸에 남고 아래 방향키로 목록에 들어갑니다. 그 아래 24px을 띄운 폭 1080px 상자에 화면의 내용을 그리며, 창이 1080px보다 좁으면 상자 안에서만 가로로 스크롤하고 페이지는 넘치지 않습니다.
- 표에서 상세로: 파티, 공대 표에서 찾은 행의 초상화를 누르면 그 캐릭터의 상세로 갑니다. 이름 칸은 편집 칸이라 링크가 아닙니다.
- 게임 바: `/multisearch`에서만 화면 상자 안의 테두리 박스 맨 위에 두고, 그 아래에 파티, 공대 표를 둡니다. `파티`, `공대` 탭, 화면 제목과 찾은 수, 회차, 마지막 캡처 시각, 게임 연결 칩, 스냅샷, 복사, 캡처 버튼 순서입니다.
- 화면을 옮길 때: host와 캡처 provider(`ScreenCaptureProvider`)가 라우터 위에 있어 화면 공유 연결이 남습니다. 표의 행, 회차, 마지막 캡처 시각, 스냅샷, 맞바꾼 자리도 provider와 store에 있으므로 멀티서치는 다른 화면으로 가면 unmount하고 돌아오면 같은 상태로 다시 그립니다. 붙여넣기와 자동 인식 회차, 자리 맞바꾸기의 Alt+방향키 차단은 멀티서치가 그려진 동안에만 합니다.

## 코드 위치

- `src/WebApp.tsx`: 웹 라우터를 둡니다.
- `src/animations/`: 화면에서 함께 쓰는 전환 animation과 GSAP 설정을 둡니다.
- `src/assets/`: 글꼴, 로고, 시즌 배경 이미지를 둡니다.
- `src/components/`: 웹 앱의 화면 컴포넌트와 스타일을 둡니다.
- `src/constants/`: 화면 크기와 서버 선택지 상수를 둡니다.
- `src/core/`: React와 UI 폴더를 import하지 않는 검색, 캡처, OCR 로직을 둡니다.
- `src/hooks/`: 화면의 검색, 캡처, 상태를 연결하는 React hook을 둡니다.
- `src/host/`: 브라우저 API를 검색, 캡처, 클립보드 기능과 연결합니다.
- `src/lib/`: 조회 캐시와 카드 표시, 저장된 캐릭터 처리 함수를 둡니다.
- `src/pages/`: 주소별 화면과 그 화면이 쓰는 컴포넌트, 로직을 둡니다.
- `src/styles/`: 화면이 함께 쓰는 StyleX breakpoint를 둡니다.
- `src/testing/`: UI 테스트 setup, fixture와 host, router 테스트 도구를 둡니다.
- `src/core/adventure-guild/`: 모험단 정보, 주간 기록, 활동 응답 schema를 둡니다.
- `src/core/api/`: 던삐삐 API 요청 함수와 응답 schema를 둡니다.
- `src/core/capture/`: 캡처 회차, 슬롯, 자리와 캡처한 카드의 검색 상태를 둡니다.
- `src/core/capture/party/`: 파티 화면 인식과 파티 캡처 machine을 둡니다.
- `src/core/capture/raid/`: 공대 상세 창 검출, 행 인식, 공대 캡처 machine과 기준 이미지를 둡니다.
- `src/core/catalog/`: 스킬 창, 서약, 게임 문구 데이터 묶음의 schema를 둡니다.
- `src/core/character/`: 캐릭터 상세, 장비, 서약, 카드 표시 함수와 캐릭터 타입을 둡니다.
- `src/core/diagnostics/`: 브라우저 console에 남기는 진단 코드와 문구를 둡니다.
- `src/core/ocr/`: OCR worker, 닉네임 이미지 처리와 인식 결과 선택을 둡니다.
- `src/core/ranking/`: 명성 랭킹, 캐릭터 통계, 스킬 통계 응답 schema를 둡니다.
- `src/core/search/`: 캐릭터 검색 요청, 식별, 초상화 비교와 검색 상태를 둡니다.
- `src/core/servers/`: 서버 이름과 서버 ID 타입을 둡니다.
- `src/core/testing/`: core와 UI 테스트가 함께 쓰는 fixture를 둡니다.
- `src/core/today-grade/`: 오늘 등급 타입과 희귀도 구분을 둡니다.
- `src/core/time-format.ts`: 경과 시간, 서울 시각, 시즌 이름 표시 함수를 둡니다.

## 라이트, 다크 모드

화면은 라이트와 다크 모드가 있고, 기본은 시스템 설정(`prefers-color-scheme`)을 따릅니다. 고른 모드가 없으면 시스템 설정을 바꿀 때 화면도 바로 바뀝니다. 전역 바 오른쪽 끝의 버튼(다크에서는 해, 라이트에서는 달)을 누르면 다른 모드로 바뀌고, 고른 모드를 브라우저의 `localStorage` `dfragon:color-mode`에 저장해 시스템 설정보다 앞세웁니다. 고른 모드를 지우는 버튼은 없으며, 사이트 데이터를 지우면 다시 시스템 설정을 따릅니다.

`index.html`의 script가 첫 그리기 전에 저장된 모드를 읽어 `html`의 `data-color-mode`로 붙이므로, 새로 고칠 때 다른 모드가 잠깐 보이지 않습니다. 브라우저 탭과 주소창 색(`theme-color`)은 모드별 전역 바 색(라이트 `#fafafa`, 다크 `#101012`)이고, 고른 모드가 있으면 그 모드의 값을 씁니다. 색 값은 `@dfragon/ui`의 [`tokens.css`](../../packages/ui/tokens.css)에 있습니다.

## 글꼴과 고지

웹 앱은 본문과 숫자 모두 Pretendard Variable을 씁니다. 글꼴과 사이트 자산은 사이트에 함께 배포하고 외부 CDN에서 받지 않습니다.

서드파티 고지는 화면에 링크하지 않고 빌드 산출물의 `notices`에 둡니다. 배포하면 `https://dfragon.com/notices/` 아래에서 볼 수 있습니다.

- `notices/THIRD-PARTY.txt`: 번들 입력 package의 license와 NOTICE
- `notices/client/`: 글꼴(Pretendard Variable)과 Lucide 아이콘 고지
- `notices/site/NOTICE.md`: Neople Open API 로고(컬러, 회색)의 출처, 권리([원본](NOTICE.md))
- `ocr/`: OCR 모델과 ONNX Runtime의 license, NOTICE

## 테스트 경계

`src/App.test.tsx`는 페이지가 웹 앱 밖에 빌드 commit을 그리고 그 밖의 헤더, 제목, 사이트 문구와 내려받기 링크가 없으며 GitHub Releases API를 부르지 않는지 확인합니다. `build-commit.test.ts`는 빌드 commit의 7자리와 `dev` 대체 값을 확인합니다. 전역 바와 화면은 웹 앱의 테스트가 봅니다.

웹 앱의 브라우저 host는 `apps/web/src/host/`의 역할별 테스트가, 화면 연결은 [`WebApp.test.tsx`](src/WebApp.test.tsx)가 확인합니다. API 경로로 후보, 상세, 초상화를 받는지, 명령 호출 중에 수명 알림을 동기적으로 보내지 않는지, 브라우저 host만으로 화면이 그려지는지, `/`에는 전역 바의 검색창과 현재 메뉴 항목 없이 큰 검색창과 명성 랭킹 박스가, `/multisearch`에는 전역 메뉴의 현재 항목, 게임 바와 표가, 없는 주소에는 안내와 첫 화면 링크만 그려지는지, 화면 상자 아래 푸터에 Neople 로고 링크와 두 약관 링크가 있고 약관 링크를 누르면 그 화면으로 가며 지금 화면의 링크만 현재 위치로 알리는지, `/terms`, `/privacy`를 직접 열면 제목 줄과 빈 본문만 그려지는지, 멀티서치에서 고친 이름과 맞바꾼 자리가 메인 화면과 없는 주소 화면에 다녀와도 남는지, 다른 화면에서 붙여 넣은 이미지가 회차를 시작하지 않고 붙여넣기를 받을 화면이 없으면 host가 그 이미지를 들지 않는지, 문서 전체의 드래그를 막지 않는지, 붙여 넣은 이미지가 회차의 프레임이 되고 웹 문구로 안내하는지, 게임 연결 칩으로 공유한 창을 캡처 버튼이 읽고 공유 중의 붙여넣기 회차는 붙여 넣은 이미지를 읽는지, 공유한 동안 지금 화면의 새 구성이 마을에서 2번 연속 보일 때만 그 화면의 회차가 자동으로 시작되고 회차가 읽은 프레임이 기준이 되는지, 공유를 멈추면 연결 전으로 돌아가는지, 멀티서치의 Alt+방향키는 브라우저에 넘기지 않고 없는 주소 화면에서는 넘기는지를 봅니다. 화면 공유(`getDisplayMedia`), 초상화와 붙여 넣은 이미지의 디코딩(`createImageBitmap`, WebGL)과 OCR worker는 jsdom에 없어 실제 브라우저에서 pngjs 결과와 비교하고 표의 행이 채워지는지 확인합니다. 닉네임 검색, 서버 변경, 클립보드 복사도 멀티서치를 브라우저에서 열어 확인합니다. 모드 전환 버튼이 고른 모드가 없을 때 시스템 설정을 따르고, 누르면 그 모드를 `html`과 `theme-color`에 붙여 저장하며, 깨진 저장 값은 버리는지는 `src/components/ColorModeToggle.test.tsx`가 봅니다. `index.html`의 첫 그리기 전 script와 두 모드의 실제 색은 브라우저에서 새로 고쳐 확인합니다. jsdom은 실제 레이아웃을 재현하지 않으므로 390px 폭에서 화면 상자 안에만 가로 스크롤이 생기고 페이지는 넘치지 않는지, 글자 대비, 키보드 조작은 production build를 브라우저에서 확인합니다.
