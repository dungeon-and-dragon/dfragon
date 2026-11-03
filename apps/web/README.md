# Web

던삐삐 웹 앱 정적 사이트입니다. `dfragon.com`에 올리며, 첫 화면에서 설치 없이 닉네임 검색, 스크린샷 붙여넣기, 화면 공유로 파티, 공대를 확인합니다. 첫 화면은 어두운 바탕에 페이지 가운데의 웹 앱 상자와 아래 가운데의 회색 Neople Open API 로고(86×24)만 있고, 사이트 상단 바, 푸터, 배경 그림, 소개 문구는 없습니다. 데스크톱 브라우저용이며 휴대폰은 지원하지 않습니다. 분석, 쿠키, 로그인이 없습니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/web dev
pnpm --filter @dfragon/web test
pnpm --filter @dfragon/web lint
pnpm --filter @dfragon/web build
pnpm --filter @dfragon/web preview
```

`build`는 `tsc -b`와 Vite production build를 포함하므로 같은 변경을 검증할 때 `typecheck`를 다시 실행할 필요는 없습니다. `pnpm verify`는 Web의 `test`, `build`를 실행합니다. 산출물은 `dist`에 생기며, `public/CNAME`(`dfragon.com`)이 함께 복사됩니다. dev 사이트 빌드는 이 `CNAME`을 뺍니다([배포](#배포)).

`dev`와 `build`는 먼저 `prepare:ocr-assets`로 `@dfragon/client-core`의 [`prepare-ocr-assets.mjs`](../../packages/client-core/scripts/prepare-ocr-assets.mjs)에 출력 폴더를 넘겨 실행해 OCR 모델과 ONNX Runtime WASM을 `public/ocr`에 만듭니다. 이 폴더는 Git에서 제외합니다. 파인튜닝 모델을 쓰므로 처음 checkout할 때 [`@dfragon/models` 받기](../../packages/models/README.md#받기)의 `ocr-finetuned` submodule을 받아야 하며, 받지 않으면 두 명령이 실패합니다.

`dev` 서버(`http://localhost:5173/`)는 같은 origin의 `/characters`, `/items` 요청을 운영 API(`https://api.dfragon.com`)로 넘기므로 운영 API의 CORS 허용 origin이나 로컬 API, Neople key 없이 첫 화면에서 닉네임 검색을 해 볼 수 있습니다. production build(`build`, `preview`)는 운영 API를 직접 부르므로 CORS가 허용한 origin에서만 검색합니다.

첫 화면에 던파 창의 스크린샷(Alt+PrtSc)을 Ctrl+V로 붙여 넣으면 지금 화면(파티, 공대)의 인식 회차가 시작됩니다. 첫 붙여넣기 때 `/ocr`의 모델과 WASM을 받습니다. `dev` 서버는 첫 붙여넣기에서 `onnxruntime-web/webgpu`를 처음 최적화하며 페이지를 한 번 다시 읽으므로, 그때는 다시 붙여 넣습니다.

상단 바 오른쪽 끝의 "화면 공유" 버튼(연결 뒤에는 "게임 연결됨" 칩)을 누르면 브라우저의 화면 공유 창이 열립니다. 던파 창을 공유한 뒤 캡처 버튼을 누르면 공유 화면에서 한 장을 읽어 지금 화면의 회차를 시작합니다. 브라우저의 공유 중지를 누르면 칩이 연결 전으로 돌아갑니다. 화면 공유는 `localhost`나 HTTPS 페이지에서만 열립니다.

던파 창을 공유한 동안에는 약 1초마다 공유 화면을 보고, 게임이 마을에 있을 때 지금 화면의 구성이 바뀌면 그 화면의 회차를 자동으로 시작합니다. 파티 화면이면 게임의 파티 프레임만, 공대 화면이면 공대 상세 창만 보며, 자동 인식은 화면(파티, 공대)을 바꾸지 않습니다. 구성이 같으면 회차를 시작하지 않으므로 같은 구성을 다시 읽으려면 캡처 버튼을 누릅니다. 판정 규칙은 [마을 자동 인식](../../docs/rules/web-client.md#마을-자동-인식)을 따릅니다.

## 배포

main에 merge하면 사이트는 `https://dev.dfragon.com`에만 자동으로 올라갑니다. 운영 `https://dfragon.com`은 저장소 소유자가 수동 실행할 때만 바뀌며, 배포 시점은 소유자가 정합니다.

- dev: main push마다 [`web-dev-pages.yml`](../../.github/workflows/web-dev-pages.yml)이 공개 저장소 [`dungeon-and-dragon/dfragon-dev`](https://github.com/dungeon-and-dragon/dfragon-dev)의 배포 workflow를 실행하고, 그 workflow가 실행 시점의 이 저장소 main을 checkout해 빌드한 뒤 `dfragon-dev`의 GitHub Pages에 올립니다. dev 배포는 한 번에 하나씩 돌고 각 실행이 그때의 main을 받으므로, 연속으로 merge해도 마지막 실행이 최신 main을 올립니다. `dfragon-dev`에서 수동 실행하면 PR branch 같은 다른 ref도 올릴 수 있습니다. 실행 방법은 그 저장소의 README에 있습니다.
- 운영: [`web-pages.yml`](../../.github/workflows/web-pages.yml)은 저장소 소유자가 Actions에서 main으로 수동 실행할 때만 이 저장소의 GitHub Pages에 올립니다.

두 사이트는 같은 빌드 단계 [`web-site-build`](../../.github/actions/web-site-build/action.yml) action으로 `pnpm --filter @dfragon/web build`의 `dist`를 만듭니다. action은 빌드 전에 `ocr-finetuned` submodule만 받아 OCR 자산을 `dist/ocr`에 넣고, 점수 엔진 submodule은 받지 않습니다. dev 빌드는 `CNAME`을 빼고, `robots.txt`를 `Disallow: /`로 바꿔 검색 엔진의 크롤링을 막으며, 빌드한 커밋 SHA를 `version.txt`에 둡니다. 배포된 dev 커밋은 `https://dev.dfragon.com/version.txt`로 확인합니다. OCR 모델과 WASM은 첫 붙여넣기나 첫 화면 공유 때 받으므로 닉네임 검색만 하는 방문자는 받지 않습니다.

### 운영 사이트 설정

저장소 소유자가 한 번 해야 하는 설정입니다. workflow와 에이전트는 이 설정을 바꾸지 않습니다.

1. Settings → Pages → Build and deployment의 Source를 GitHub Actions로 정합니다.
2. 같은 화면의 Custom domain에 `dfragon.com`을 입력합니다. 배포마다 `CNAME` 파일이 함께 올라가므로 도메인 설정이 유지됩니다.
3. Porkbun의 `dfragon.com` DNS에 아래 레코드를 넣습니다. IP는 GitHub 문서 [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)의 apex 도메인 값이며, 설정 전에 문서와 다시 대조합니다.

   | 종류 | 호스트 | 값 |
   | --- | --- | --- |
   | A | (비움, `dfragon.com`) | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` 네 개 |
   | AAAA | (비움, `dfragon.com`) | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` 네 개 |
   | CNAME | `www` | `dungeon-and-dragon.github.io` |

4. DNS가 확인되면 Pages 화면에서 Enforce HTTPS를 켭니다. 인증서 발급에는 시간이 걸릴 수 있습니다.

`www.dfragon.com`을 `dfragon.com`으로 보내는 일은 GitHub Pages가 합니다. Custom domain이 apex(`dfragon.com`)이고 `www` CNAME이 `dungeon-and-dragon.github.io`를 가리키면 `www`로 들어온 요청을 apex로 리디렉션하므로 별도 리디렉션 설정이 없습니다.

`api.dfragon.com`은 운영 API가 쓰는 레코드입니다. 위 레코드를 넣을 때 건드리지 않습니다.

### dev 사이트 설정

저장소 소유자가 한 번 해야 하는 설정입니다. workflow와 에이전트는 이 설정을 바꾸지 않습니다.

1. 공개 저장소 `dungeon-and-dragon/dfragon-dev`를 만들고, Settings → Pages의 Source를 GitHub Actions로, Custom domain을 `dev.dfragon.com`으로 정한 뒤 Enforce HTTPS를 켭니다.
2. Cloudflare의 `dfragon.com` DNS에 `dev` CNAME → `dungeon-and-dragon.github.io`를 DNS only로 넣습니다.
3. 이 저장소의 Actions Secret `DFRAGON_DEV_DISPATCH_TOKEN`에 fine-grained PAT를 넣습니다. 대상 저장소는 `dfragon-dev` 하나, 권한은 Actions read and write만입니다. `web-dev-pages.yml`은 이 token을 `dfragon-dev`의 workflow 실행에만 쓰고 빌드에는 넘기지 않습니다.

## 구성

- `index.html`: 제목, 설명, OG 메타 태그. OG 이미지는 두지 않아 링크 미리보기는 제목과 설명만 보입니다(2026-10-31 결정, [Issue #1036](https://github.com/dungeon-and-dragon/dfragon/issues/1036)).
- `src/App.tsx`: 웹 앱 상자를 페이지 가운데에, 회색 Neople Open API 로고(86×24)를 페이지 아래 가운데에 놓는 첫 화면입니다. 웹 앱 상자는 창이 1080px보다 좁으면 상자 안에서만 가로로 스크롤하고 페이지는 넘치지 않습니다.
- 웹 앱: `@dfragon/client`가 사이트용으로 공개한 `packages/client/src/site/web/index.ts`를 `@dfragon/client/web`으로 가져옵니다. `src/WebClient.tsx`가 모듈을 읽을 때 한 번 `installBrowserHost`를 부르고(개발 서버는 같은 origin, production build는 `https://api.dfragon.com`), `App.tsx`가 이 모듈을 나중에 받아 첫 화면에 그립니다. `installBrowserHost`는 전역을 붙이지 않고 검색, 캡처, 등급 연산을 담은 host를 돌려주며 페이지의 붙여넣기(`paste`)를 받습니다. 이 host를 `WebApp`에 넘기면 React context로 화면에 전달되어 상단 바와 검색 화면을 폭 1080px 상자 안에 그립니다. 상자 높이는 내용에 맞고, 웹 앱을 받는 동안에는 상단 바 두 단 높이(88px)의 빈 상자를 둡니다. 상단 바의 캡처 칩 자리에는 화면 공유를 요청하는 게임 연결 칩을 넣습니다. 붙여 넣은 이미지와 공유 화면의 프레임은 `createImageBitmap`과 WebGL로 읽고, 공대 템플릿 PNG도 같은 디코더로 받습니다. 계약은 [웹 클라이언트](../../docs/rules/web-client.md)를 따릅니다. `@dfragon/client`의 다른 source는 직접 import하지 않습니다. `@dfragon/client`, `@dfragon/client-core`는 build 없이 source를 export하고, Vite가 직접 번들합니다.

## 글꼴과 고지

웹 앱은 마루미냐 한글과 Barlow Condensed를 씁니다. 두 글꼴과 사이트 자산은 사이트에 함께 배포하고 외부 CDN에서 받지 않습니다.

서드파티 고지는 화면에 링크하지 않고 빌드 산출물의 `notices`에 둡니다. 배포하면 `https://dfragon.com/notices/` 아래에서 볼 수 있습니다.

- `notices/THIRD-PARTY.txt`: 번들 입력 package의 license와 NOTICE
- `notices/client/`: 글꼴(마루미냐 한글, Barlow Condensed)과 Lucide 아이콘 고지
- `notices/site/NOTICE.md`: Neople Open API 로고(컬러, 회색)의 출처, 권리([원본](NOTICE.md))
- `ocr/`: OCR 모델과 ONNX Runtime의 license, NOTICE

## 테스트 경계

`src/App.test.tsx`는 첫 화면에 웹 앱 상자와 Neople 로고 링크만 있고 상단 바, 푸터, 사이트 문구, 내려받기 링크가 없으며 GitHub Releases API를 부르지 않는지 확인합니다.

웹 앱의 브라우저 host는 `packages/client`의 `site/web/*.test.ts(x)`가 확인합니다. API 경로로 후보, 상세, 초상화를 받는지, 명령 호출 중에 수명 알림을 동기적으로 보내지 않는지, 브라우저 host만으로 화면이 그려지는지, 문서 전체의 드래그를 막지 않는지, 붙여 넣은 이미지가 회차의 프레임이 되고 웹 문구로 안내하는지, 게임 연결 칩으로 공유한 창을 캡처 버튼이 읽고 공유 중의 붙여넣기 회차는 붙여 넣은 이미지를 읽는지, 공유한 동안 지금 화면의 새 구성이 마을에서 2번 연속 보일 때만 그 화면의 회차가 자동으로 시작되고 회차가 읽은 프레임이 기준이 되는지, 공유를 멈추면 연결 전으로 돌아가는지, 앱 상자 안의 Alt+방향키를 브라우저에 넘기지 않는지를 봅니다. 화면 공유(`getDisplayMedia`), 초상화와 붙여 넣은 이미지의 디코딩(`createImageBitmap`, WebGL)과 OCR worker는 jsdom에 없어 실제 브라우저에서 pngjs 결과와 비교하고 카드가 채워지는지 확인합니다. 닉네임 검색, 서버 변경, 클립보드 복사도 첫 화면을 브라우저에서 열어 확인합니다. jsdom은 실제 레이아웃을 재현하지 않으므로 390px 폭에서 웹 앱 상자 안에만 가로 스크롤이 생기고 페이지는 넘치지 않는지, 글자 대비, 키보드 조작은 production build를 브라우저에서 확인합니다.
