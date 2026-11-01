# Web

던삐삐 소개와 내려받기 정적 사이트입니다. `dfragon.com`에 올리며, 첫 화면은 한 문장, 최신 포터블 exe를 받는 버튼, 각본대로 움직이는 던삐삐 창 목업과 푸터의 Neople Open API 로고뿐입니다. 분석, 쿠키, 로그인이 없습니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/web dev
pnpm --filter @dfragon/web test
pnpm --filter @dfragon/web lint
pnpm --filter @dfragon/web build
pnpm --filter @dfragon/web preview
```

`build`는 `tsc -b`와 Vite production build를 포함하므로 같은 변경을 검증할 때 `typecheck`를 다시 실행할 필요는 없습니다. `pnpm verify`는 Web의 `test`, `build`를 실행합니다. 산출물은 `dist`에 생기며, `public/CNAME`(`dfragon.com`)이 함께 복사됩니다.

`dev`와 `build`는 먼저 `prepare:ocr-assets`로 Desktop의 [`prepare-ocr-assets.mjs`](../desktop/scripts/prepare-ocr-assets.mjs)를 출력 폴더만 바꿔 실행해 OCR 모델과 ONNX Runtime WASM을 `public/ocr`에 만듭니다. 이 폴더는 Git에서 제외합니다. 파인튜닝 모델을 쓰므로 처음 checkout할 때 [`@dfragon/models` 받기](../../packages/models/README.md#받기)의 `ocr-finetuned` submodule을 받아야 하며, 받지 않으면 두 명령이 실패합니다.

웹 앱은 첫 화면에 넣기 전까지 `dev` 서버의 개발용 화면 `http://localhost:5173/web-app.html`에서 엽니다. 이 화면은 production build의 입력이 아닙니다. `dev` 서버는 같은 origin의 `/characters`, `/items` 요청을 운영 API(`https://api.dfragon.com`)로 넘기므로 운영 API의 CORS 허용 origin이나 로컬 API, Neople key 없이 닉네임 검색을 해 볼 수 있습니다.

개발용 화면에 던파 창의 스크린샷(Alt+PrtSc)을 Ctrl+V로 붙여 넣으면 지금 화면(파티, 공대)의 인식 회차가 시작됩니다. 첫 붙여넣기 때 `/ocr`의 모델과 WASM을 받습니다. `dev` 서버는 첫 붙여넣기에서 `onnxruntime-web/webgpu`를 처음 최적화하며 페이지를 한 번 다시 읽으므로, 그때는 다시 붙여 넣습니다.

상단 바의 게임 연결 칩을 누르면 브라우저의 화면 공유 창이 열립니다. 던파 창을 공유한 뒤 캡처 버튼이나 Alt+R(페이지에 포커스가 있을 때)을 누르면 공유 화면에서 한 장을 읽어 지금 화면의 회차를 시작합니다. 브라우저의 공유 중지를 누르면 칩이 연결 전으로 돌아갑니다. 화면 공유는 `localhost`나 HTTPS 페이지에서만 열립니다.

## 배포

[`web-pages.yml`](../../.github/workflows/web-pages.yml)은 저장소 소유자가 Actions에서 main으로 수동 실행할 때만 `pnpm --filter @dfragon/web build`의 `dist`를 GitHub Pages에 올립니다. workflow는 빌드 전에 `ocr-finetuned` submodule만 받아 OCR 자산을 `dist/ocr`에 넣고, 점수 엔진 submodule은 받지 않습니다. OCR 모델과 WASM은 첫 붙여넣기나 첫 화면 공유 때 받으므로 닉네임 검색만 하는 방문자는 받지 않습니다. 내려받기 버튼은 방문 시점에 GitHub API에서 최신 Release를 읽으므로 새 Release를 게시해도 다시 배포하지 않습니다.

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

## 구성

- `index.html`: 제목, 설명, OG 메타 태그. OG 이미지는 두지 않아 링크 미리보기는 제목과 설명만 보입니다(2026-10-31 결정, [Issue #1036](https://github.com/dungeon-and-dragon/dfragon/issues/1036)).
- `src/App.tsx`: 상단 바(아이콘, 이름, GitHub 링크), 첫 화면, 푸터입니다. 첫 화면 배경은 방문자의 현지 시각에 따라 Desktop 창 아이콘과 같은 밤, 새벽, 낮, 오후 바다 그림으로 바뀝니다.
- `src/download`: GitHub API `repos/dungeon-and-dragon/dfragon/releases/latest`에서 `DFragon-<버전>-x64-portable.exe`의 주소를 읽어 내려받기 버튼에 씁니다. 버튼 아래에 버전, 용량 같은 안내 줄은 두지 않습니다(2026-10-31 결정). 요청이 실패하거나, 사용량 제한에 걸리거나, 포터블 exe가 없거나, 주소가 `https://github.com/` 밖이면 버튼은 Release 페이지(`releases/latest`)로 보냅니다. GitHub의 `releases/latest`는 Pre-release를 제외합니다.
- 창 목업: Desktop renderer가 사이트용으로 공개한 `apps/desktop/src/frontend/src/site/index.ts`를 `@dfragon/desktop-site` 별칭으로 가져옵니다. 실제 상단 바와 카드 컴포넌트를 쓰고, 캡처와 검색 IPC 대신 각본 상태로 카드를 채웁니다. Desktop의 다른 source는 직접 import하지 않습니다. 별칭은 `workspace-aliases.ts`와 `tsconfig.app.json`의 `paths`에 있습니다.
- 창 목업 강조: `src/WindowMockup.tsx`가 목업을 감싸고 `src/mockup-highlight`가 그 위에 덮어 그립니다. 목업이 실제로 눌러진다는 걸 보이려고 처음 2초 가까이 가짜 커서가 캡처를 눌러 보이고, 검색 메뉴, 스냅샷, 복사, 캡처 버튼에 깜박이는 강조 테두리를 계속 둡니다. Desktop 컴포넌트를 고치지 않으려고 대상은 Desktop의 접근성 이름으로 찾습니다. 움직임 줄이기 설정이나 캡처 버튼이 화면 밖에 있는 좁은 화면에서는 가짜 커서를 건너뜁니다.
- 웹 앱: Desktop의 `apps/desktop/src/frontend/src/site/web/index.ts`를 `@dfragon/desktop-web` 별칭으로 가져옵니다. `installBrowserHost`가 Desktop renderer의 bridge 9개를 브라우저 구현으로 채우고 페이지의 붙여넣기(`paste`)와 Alt+W, Alt+A, 화면 공유 중의 Alt+R을 받으며, 돌려주는 host를 `WebApp`에 넘기면 Desktop의 상단 바와 검색 화면을 파티 1280×163, 공대 1280×300 상자 안에 그립니다. 상단 바의 캡처 칩 자리에는 화면 공유를 요청하는 게임 연결 칩을 넣습니다. 붙여 넣은 이미지와 공유 화면의 프레임은 `createImageBitmap`과 WebGL로 Desktop의 pngjs와 같은 방식으로 읽고, 공대 템플릿 PNG도 같은 디코더로 받습니다. 계약은 [웹 클라이언트](../../docs/rules/web-client.md)를 따릅니다. 아직 첫 화면에는 넣지 않았고 개발용 화면(`web-app.html`, `src/dev/web-app.tsx`)에서만 엽니다.

## 글꼴과 고지

제목은 마루미냐 한글을 12px의 정수 배로, 본문은 Noto Sans KR, 숫자는 Barlow Condensed로 씁니다. 세 글꼴과 사이트 자산은 사이트에 함께 배포하고 외부 CDN에서 받지 않습니다.

서드파티 고지는 화면에 링크하지 않고 빌드 산출물의 `notices`에 둡니다. 배포하면 `https://dfragon.com/notices/` 아래에서 볼 수 있습니다.

- `notices/THIRD-PARTY.txt`: 번들 입력 package의 license와 NOTICE(Noto Sans KR의 OFL 1.1 포함)
- `notices/desktop/`: Desktop과 같은 글꼴(마루미냐 한글, Barlow Condensed)과 Lucide 아이콘 고지
- `notices/site/NOTICE.md`: 캐릭터 초상화와 Neople Open API 로고의 출처, 권리([원본](NOTICE.md))
- `ocr/`: OCR 모델과 ONNX Runtime의 license, NOTICE. Desktop의 `out/frontend/ocr`과 같은 파일입니다.

## 테스트 경계

`src/download`의 테스트는 2026-10-31 v0.1.0 응답 형태로 버튼 주소와 Release 페이지로 보내는 경우를 확인합니다. 창 목업의 각본은 Desktop의 `site/WindowMockup.test.tsx`가 확인합니다. 강조할 버튼을 찾는지는 `src/mockup-highlight/MockupHighlights.test.tsx`가 확인하므로, Desktop 쪽 접근성 이름이 바뀌면 이 테스트가 실패합니다. 가짜 커서의 움직임과 테두리 위치는 실제 레이아웃이 필요해 브라우저에서 확인합니다.

웹 앱의 브라우저 host는 Desktop의 `site/web/*.test.ts(x)`가 확인합니다. API 경로로 후보, 상세, 초상화를 받는지, 명령 호출 중에 수명 알림을 동기적으로 보내지 않는지, preload 없이 화면이 그려지는지, 문서 전체의 드래그를 막지 않는지, 붙여 넣은 이미지가 회차의 프레임이 되고 웹 문구로 안내하는지, 게임 연결 칩으로 공유한 창을 캡처 버튼이 읽고 공유 중의 붙여넣기 회차는 붙여 넣은 이미지를 읽는지, 공유를 멈추면 연결 전으로 돌아가는지, Alt+W와 Alt+A, 공유 중의 Alt+R을 Desktop 단축키로 알리고 앱 상자 안의 Alt+방향키를 브라우저에 넘기지 않는지를 봅니다. 화면 공유(`getDisplayMedia`), 초상화와 붙여 넣은 이미지의 디코딩(`createImageBitmap`, WebGL)과 OCR worker는 jsdom에 없어 실제 브라우저에서 Desktop의 pngjs 결과와 비교하고 카드가 채워지는지 확인합니다. 닉네임 검색, 서버 변경, 클립보드 복사도 개발용 화면을 브라우저에서 열어 확인합니다. jsdom은 실제 레이아웃을 재현하지 않으므로 390px 폭의 가로 넘침, 글자 대비, 키보드 조작은 production build를 브라우저에서 확인합니다.
