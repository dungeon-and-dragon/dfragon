# Web

던삐삐 웹 앱 정적 사이트입니다. `dfragon.com`에 올리며, 첫 화면에서 설치 없이 닉네임 검색, 스크린샷 붙여넣기, 화면 공유로 파티, 공대를 확인합니다. 화면마다 주소가 있으며 지금은 `/`(파티, 공대 표), `/c/<serverId>/<characterId>`(캐릭터 상세), 없는 주소 안내가 있습니다. 모든 화면은 위쪽의 전역 바, 그 아래 폭 1080px 화면 상자, 페이지 아래 가운데의 회색 Neople Open API 로고(86×24)로 되어 있고 푸터, 배경 그림, 소개 문구는 없습니다. 데스크톱 브라우저용이며 휴대폰은 지원하지 않습니다. 분석, 쿠키, 로그인이 없습니다.

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

`dev`와 `build`는 먼저 `prepare:ocr-assets`로 `@dfragon/client-core`의 [`prepare-ocr-assets.mjs`](../../packages/client-core/scripts/prepare-ocr-assets.mjs)에 출력 폴더를 넘겨 실행해 OCR 모델과 ONNX Runtime WASM을 `public/ocr`에 만듭니다. 이 폴더는 Git에서 제외합니다. 파인튜닝 모델을 쓰므로 처음 checkout할 때 [`@dfragon/models` 받기](../../packages/models/README.md#받기)의 `ocr-finetuned` submodule을 받아야 하며, 받지 않으면 두 명령이 실패합니다.

`dev` 서버(`http://localhost:5173/`)는 같은 origin의 `/api/*` 요청을 `/api`를 뗀 경로로 운영 API(`https://api.dfragon.com`)에 넘기므로 운영 API의 CORS 허용 origin이나 로컬 API, Neople key 없이 첫 화면에서 닉네임 검색을 해 볼 수 있습니다. production build(`build`, `preview`)는 운영 API를 직접 부르므로 CORS가 허용한 origin에서만 검색합니다.

첫 화면에 던파 창의 스크린샷(Alt+PrtSc)을 Ctrl+V로 붙여 넣으면 지금 화면(파티, 공대)의 인식 회차가 시작됩니다. 다른 주소의 화면에서 붙여 넣은 이미지는 회차를 시작하지 않고 버립니다. 첫 붙여넣기 때 `/ocr`의 모델과 WASM을 받습니다. `dev` 서버는 첫 붙여넣기에서 `onnxruntime-web/webgpu`를 처음 최적화하며 페이지를 한 번 다시 읽으므로, 그때는 다시 붙여 넣습니다.

첫 화면 게임 바의 캡처 도구 왼쪽에 있는 "화면 공유" 버튼(연결 뒤에는 "게임 연결됨" 칩)을 누르면 브라우저의 화면 공유 창이 열립니다. 던파 창을 공유한 뒤 캡처 버튼을 누르면 공유 화면에서 한 장을 읽어 지금 화면의 회차를 시작합니다. 브라우저의 공유 중지를 누르면 칩이 연결 전으로 돌아갑니다. 다른 주소의 화면에 다녀와도 공유 연결은 남고, 다른 화면을 보는 동안 공유를 멈추면 돌아왔을 때 연결 전입니다. 화면 공유는 `localhost`나 HTTPS 페이지에서만 열립니다.

던파 창을 공유한 동안에는 약 1초마다 공유 화면을 보고, 게임이 마을에 있을 때 지금 화면의 구성이 바뀌면 그 화면의 회차를 자동으로 시작합니다. 파티 화면이면 게임의 파티 프레임만, 공대 화면이면 공대 상세 창만 보며, 자동 인식은 화면(파티, 공대)을 바꾸지 않습니다. 구성이 같으면 회차를 시작하지 않으므로 같은 구성을 다시 읽으려면 캡처 버튼을 누릅니다. 자동 인식 회차도 첫 화면을 보는 동안에만 시작합니다.

## 배포

main에 merge하면 사이트는 `https://dev.dfragon.com`에만 자동으로 올라갑니다. 운영 `https://dfragon.com`은 저장소 소유자가 수동 실행할 때만 바뀌며, 배포 시점은 소유자가 정합니다.

- dev: main push마다 [`web-workers.yml`](../../.github/workflows/web-workers.yml)이 그 커밋을 빌드해 Cloudflare Worker `dfragon-web-dev`에 올립니다. 이 Worker가 `https://dev.dfragon.com`과 workers.dev 주소 `https://dfragon-web-dev.dfragon.workers.dev`를 함께 맡습니다. 배포는 한 번에 하나씩 돌고 대기 중인 실행은 새 실행으로 바뀌므로, 연속으로 merge해도 마지막 실행이 최신 main을 올립니다. 저장소 소유자는 Actions에서 target `dev`로 수동 실행해 다른 ref를 올릴 수도 있습니다.
- PR 미리보기: 이 저장소 브랜치의 PR이 `apps/web`, `packages/client`, `packages/client-core`, `packages/ui`, `packages/lib`, `packages/licenses`, `packages/models`(OCR 모델 submodule 포함), root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`이나 이 workflow를 바꾸면, 같은 workflow가 PR 브랜치를 빌드해 `wrangler versions upload --preview-alias pr-<번호>`로 dev Worker의 새 버전만 올립니다. 배포 중인 dev Worker 버전은 바뀌지 않고 `https://pr-<번호>-dfragon-web-dev.dfragon.workers.dev`가 생기며, 이 주소를 PR 댓글 하나로 남기고 다시 올리면 같은 댓글을 고칩니다. 같은 PR에 커밋을 더하면 돌던 미리보기는 취소됩니다. fork와 Dependabot의 PR은 Cloudflare Secret을 받지 않으므로 돌지 않습니다.
- 운영 Worker: 저장소 소유자가 Actions에서 main으로 target `production`을 골라 수동 실행할 때만 Cloudflare Worker `dfragon-web`에 올리며, 다른 ref에서는 job이 돌지 않습니다. 이 Worker가 `https://dfragon.com`을 맡고 workers.dev 주소는 두지 않습니다. 운영 빌드는 같은 origin 프록시 대신 `https://api.dfragon.com`을 직접 부릅니다.

모든 배포는 빌드 전에 `ocr-finetuned` submodule만 받아 OCR 자산을 `dist/ocr`에 넣고, 점수 엔진 submodule은 받지 않습니다. 빌드한 커밋 SHA는 `version.txt`에 두며, dev와 PR 미리보기는 `robots.txt`를 `Disallow: /`로 바꿔 검색 엔진의 크롤링을 막습니다. 배포된 커밋은 `https://dfragon.com/version.txt`, `https://dev.dfragon.com/version.txt`로 확인합니다. OCR 모델과 WASM은 첫 붙여넣기나 첫 화면 공유 때 받으므로 닉네임 검색만 하는 방문자는 받지 않습니다.

### Cloudflare Workers

두 사이트는 응답 헤더를 정할 수 있는 Cloudflare Workers에서 돕니다(ADR 0017).

- 정적 파일은 Workers static assets가 바로 응답합니다. [`public/_headers`](public/_headers)가 static assets의 모든 응답에 `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`를 붙이고 Worker가 `/ocr/*` 응답에 같은 COEP를 붙여 페이지와 OCR worker가 cross-origin 격리되므로 OCR의 ONNX Runtime WASM이 여러 thread로 돕니다. 해시가 붙은 `/assets/*`는 1년 동안 캐시합니다.
- OCR 모델과 ONNX Runtime WASM은 static assets의 파일 하나 25 MiB 한도를 넘어 R2 bucket `dfragon-web-ocr`에 둡니다([`public/.assetsignore`](public/.assetsignore)가 `dist/ocr`를 static assets에서 뺍니다). 배포는 먼저 [`scripts/upload-ocr-assets.mjs`](scripts/upload-ocr-assets.mjs)로 `dist/ocr`의 파일을 내용 hash 폴더(`ocr/<hash>/`)에 올리고, 그 hash를 Worker 변수 `OCR_ASSET_VERSION`으로 넘겨 배포합니다. [Worker](worker/index.ts)는 `/ocr/*` 요청을 그 폴더에서 읽어 같은 주소로 돌려주며, 주소에 hash가 없으므로 `Cache-Control: no-cache`와 ETag로 매번 확인합니다.
- workers.dev는 운영 API의 CORS 허용 origin이 아니므로 Worker가 `/api/*` 요청을 `/api`를 뗀 경로로 `https://api.dfragon.com`에 넘깁니다(`/api/characters/candidates`는 `/characters/candidates`로 갑니다). dev Worker 빌드는 `dev.dfragon.com`과 workers.dev 주소 모두에서 열리도록 `VITE_SAME_ORIGIN_API=true`로 같은 origin의 `/api`를 API 주소로 씁니다. 이 변수가 없는 빌드는 지금처럼 운영 API를 직접 부릅니다. `/api/*` 밖의 주소는 운영 API로 넘기지 않으므로 웹 주소와 API 경로의 이름이 같아도 사이트가 응답합니다.

로컬에서는 dev 서버 대신 Worker로 production build를 띄워 헤더와 R2 경로까지 확인할 수 있습니다. `apps/web`에서 실행하며, `--local`은 wrangler의 로컬 R2에만 올립니다.

```sh
VITE_SAME_ORIGIN_API=true pnpm build
pnpm exec wrangler dev --env dev --var "OCR_ASSET_VERSION:$(pnpm --silent upload:ocr --env dev --local)"
```

운영 Worker 설정은 `wrangler.jsonc` 최상위에 있으며, wrangler와 `upload:ocr`에 빈 `--env=`를 주면 이 설정을 씁니다.

저장소 소유자가 한 번 해야 하는 설정입니다. workflow와 에이전트는 이 설정을 바꾸지 않습니다.

1. Cloudflare 계정에 R2를 켜고 bucket `dfragon-web-ocr`를 만듭니다.
2. Workers & Pages에서 workers.dev subdomain을 등록합니다. 등록하지 않으면 배포가 subdomain을 묻다가 실패합니다. 지금 subdomain은 `dfragon`이라 dev Worker 주소는 `https://dfragon-web-dev.dfragon.workers.dev`입니다.
3. Account API token을 만듭니다. 권한은 Workers 제품 범위의 Admin(처음 배포가 새 Worker를 만들어야 해서 Editor로는 안 됩니다), Workers R2 Storage Write, `dfragon.com` zone의 Workers Routes Edit(`dev.dfragon.com`, `dfragon.com` custom domain 연결)만 줍니다. Workers R2 Storage Bucket Item Write로는 wrangler의 R2 업로드가 403으로 실패합니다. 예전 Workers Scripts 권한은 legacy입니다.
4. 이 저장소의 Actions Secret `CLOUDFLARE_API_TOKEN`에 token을, `CLOUDFLARE_ACCOUNT_ID`에 계정 ID를 넣습니다.
5. Cloudflare의 `dfragon.com` DNS에 apex(`dfragon.com`)와 `dev` 이름의 레코드를 직접 넣지 않습니다. 배포가 custom domain의 DNS 레코드를 직접 만들며, 같은 이름의 레코드가 있으면 배포가 실패합니다. `api.dfragon.com`은 운영 API가 쓰는 레코드라 건드리지 않습니다.
6. `www.dfragon.com`을 `https://dfragon.com`으로 보냅니다. `www` 이름에 proxied 레코드(AAAA `100::`)를 두고, Rules → Redirect Rules에서 호스트가 `www.dfragon.com`인 요청을 경로와 query를 유지해 `https://dfragon.com`으로 301 리디렉션합니다.

## 구성

- `index.html`: 제목, 설명, OG 메타 태그. OG 이미지는 두지 않아 링크 미리보기는 제목과 설명만 보입니다(2026-10-31 결정, [Issue #1036](https://github.com/dungeon-and-dragon/dfragon/issues/1036)).
- `src/App.tsx`: 위에서 시작하는 페이지에 웹 앱을 그리고 회색 Neople Open API 로고(86×24)를 모든 화면의 페이지 아래 가운데에 놓습니다. 페이지는 창 높이를 채우고, 내용이 길면 로고가 내용 아래로 밀립니다. 웹 앱을 받는 동안에는 빈 전역 바만 둡니다.
- 웹 앱: `@dfragon/client`가 사이트용으로 공개한 `packages/client/src/site/web/index.ts`를 `@dfragon/client/web`으로 가져옵니다. `src/WebClient.tsx`가 모듈을 읽을 때 한 번 `installBrowserHost`를 부르고(개발 서버는 같은 origin의 `/api`, production build는 `https://api.dfragon.com`), `App.tsx`가 이 모듈을 나중에 받아 첫 화면에 그립니다. `installBrowserHost`는 전역을 붙이지 않고 검색, 캡처, 등급 연산을 담은 host를 돌려주며 페이지의 붙여넣기(`paste`)를 받습니다. 이 host를 `WebApp`에 넘기면 React context로 화면에 전달됩니다. 붙여 넣은 이미지와 공유 화면의 프레임은 `createImageBitmap`과 WebGL로 읽고, 공대 템플릿 PNG도 같은 디코더로 받습니다. `@dfragon/client`의 다른 source는 직접 import하지 않습니다. `@dfragon/client`, `@dfragon/client-core`는 build 없이 source를 export하고, Vite가 직접 번들합니다.
- 주소와 화면: `WebApp`이 TanStack Router(`@tanstack/react-router`)로 `/`에 파티, 공대 표를, `/c/<serverId>/<characterId>`에 캐릭터 상세(상단 요약과 장비, 서약, 스킬, 아바타와 크리쳐, 버프 강화, 스탯, 타임라인 탭)를, 그 밖의 주소에 없는 주소 화면(열려던 주소, "없는 주소입니다.", "첫 화면으로" 링크)을 그립니다. 캐릭터 상세는 고른 탭을 search param `tab`에 두고, 탭을 바꾸면 다시 조회하지 않고 지금 기록의 주소만 바꿉니다. 타임라인 탭은 상세 응답에 없어 탭을 처음 열 때 API의 `/characters/<serverId>/<characterId>/timeline`을 한 번 따로 조회하고, 같은 상세에서는 탭을 다시 열어도 조회하지 않습니다. 조회가 실패하면 다음에 탭을 열 때 다시 조회합니다. Worker의 static assets는 없는 파일 주소에 `index.html`을 돌려주고(`not_found_handling: single-page-application`) 개발 서버도 같으므로, 주소창에 어느 주소를 직접 열어도 사이트가 뜹니다. 새 화면은 그 기능이 주소를 등록하며 더합니다.
- 전역 바: 모든 화면 위에 화면 전체 폭으로 펴고, 안쪽 내용은 가운데 1080px 열에 둡니다. 왼쪽부터 브랜드(누르면 `/`), 전역 메뉴, 캐릭터 검색창, 오늘 등급, 오른쪽 끝의 모드 전환 버튼입니다. 오늘 등급은 라벨 글자 없이 퍼센트만 보이고, 보조 기술에는 "오늘 등급 N퍼센트"와 희귀도 이름으로 알립니다. 메뉴는 지금 `파티, 공대` 하나이고 지금 화면의 항목을 굵은 글자와 신호색 밑줄로 표시합니다. 검색창은 서버(기본 전체)와 이름으로 이름이 정확히 같은 캐릭터를 찾아, 한 명이면 바로 그 캐릭터의 상세로 가고 여러 명이면 아래 목록(명성 순)에서 고르며 없으면 찾지 못했다는 문구를 보입니다. 목록이 열려도 초점은 이름 칸에 남고 아래 방향키로 목록에 들어갑니다. 그 아래 24px을 띄운 폭 1080px 상자에 화면의 내용을 그리며, 창이 1080px보다 좁으면 상자 안에서만 가로로 스크롤하고 페이지는 넘치지 않습니다.
- 표에서 상세로: 파티, 공대 표에서 찾은 행의 초상화를 누르면 그 캐릭터의 상세로 갑니다. 이름 칸은 편집 칸이라 링크가 아닙니다.
- 게임 바: `/`에서만 화면 상자 맨 위에 둡니다. `파티`, `공대` 탭, 화면 제목과 찾은 수, 회차, 마지막 캡처 시각, 게임 연결 칩, 스냅샷, 복사, 캡처 버튼 순서입니다.
- 화면을 옮길 때: host와 캡처 provider(`ScreenCaptureProvider`)가 라우터 위에 있어 화면 공유 연결이 남습니다. 표의 행, 회차, 마지막 캡처 시각, 스냅샷, 맞바꾼 자리도 provider와 store에 있으므로 첫 화면은 다른 화면으로 가면 unmount하고 돌아오면 같은 상태로 다시 그립니다. 붙여넣기와 자동 인식 회차, 자리 맞바꾸기의 Alt+방향키 차단은 첫 화면이 그려진 동안에만 합니다.

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

`src/App.test.tsx`는 페이지가 웹 앱과 그 아래 Neople 로고 링크만 그리고 페이지 자체의 헤더, 푸터, 사이트 문구, 내려받기 링크가 없으며 GitHub Releases API를 부르지 않는지 확인합니다. 전역 바와 화면은 웹 앱의 테스트가 봅니다.

웹 앱의 브라우저 host는 `packages/client`의 `site/web/*.test.ts(x)`가 확인합니다. API 경로로 후보, 상세, 초상화를 받는지, 명령 호출 중에 수명 알림을 동기적으로 보내지 않는지, 브라우저 host만으로 화면이 그려지는지, `/`에는 전역 메뉴의 현재 항목, 게임 바와 표가, 없는 주소에는 안내와 첫 화면 링크만 그려지는지, 첫 화면에서 고친 이름과 맞바꾼 자리가 없는 주소 화면에 다녀와도 남는지, 다른 화면에서 붙여 넣은 이미지가 회차를 시작하지 않고 붙여넣기를 받을 화면이 없으면 host가 그 이미지를 들지 않는지, 문서 전체의 드래그를 막지 않는지, 붙여 넣은 이미지가 회차의 프레임이 되고 웹 문구로 안내하는지, 게임 연결 칩으로 공유한 창을 캡처 버튼이 읽고 공유 중의 붙여넣기 회차는 붙여 넣은 이미지를 읽는지, 공유한 동안 지금 화면의 새 구성이 마을에서 2번 연속 보일 때만 그 화면의 회차가 자동으로 시작되고 회차가 읽은 프레임이 기준이 되는지, 공유를 멈추면 연결 전으로 돌아가는지, 첫 화면의 Alt+방향키는 브라우저에 넘기지 않고 없는 주소 화면에서는 넘기는지를 봅니다. 화면 공유(`getDisplayMedia`), 초상화와 붙여 넣은 이미지의 디코딩(`createImageBitmap`, WebGL)과 OCR worker는 jsdom에 없어 실제 브라우저에서 pngjs 결과와 비교하고 표의 행이 채워지는지 확인합니다. 닉네임 검색, 서버 변경, 클립보드 복사도 첫 화면을 브라우저에서 열어 확인합니다. 모드 전환 버튼이 고른 모드가 없을 때 시스템 설정을 따르고, 누르면 그 모드를 `html`과 `theme-color`에 붙여 저장하며, 깨진 저장 값은 버리는지는 `packages/client`의 `components/ColorModeToggle.test.tsx`가 봅니다. `index.html`의 첫 그리기 전 script와 두 모드의 실제 색은 브라우저에서 새로 고쳐 확인합니다. jsdom은 실제 레이아웃을 재현하지 않으므로 390px 폭에서 화면 상자 안에만 가로 스크롤이 생기고 페이지는 넘치지 않는지, 글자 대비, 키보드 조작은 production build를 브라우저에서 확인합니다.
