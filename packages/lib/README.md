# @dfragon/lib

API, worker, 운영 app, 웹, 운영 화면과 `@dfragon/database`, `@dfragon/neople`, `@dfragon/http-server`, `@dfragon/server-core`가 함께 쓰는 입력 규칙, DNF UI 좌표, 픽셀 계산 TypeScript 패키지입니다. 앱 source, React, Node 전용 runtime에 의존하지 않는 ESM과 선언 파일을 제공하며, OCR, 저장, 네트워크 요청은 하지 않습니다.

소비 workspace의 `dependencies`에 `"@dfragon/lib": "workspace:*"`를 추가하고 `pnpm --filter @dfragon/lib build` 후 사용합니다. API, worker, 운영 app의 build와 typecheck, 위 네 package의 build는 이 패키지를 먼저 빌드합니다.

## 던파 게임 값

`@dfragon/lib/equipment-variants`는 장비 시뮬레이터에서 고를 수 있는 장비, 서약, 무기 선택지와 엔진 파일에서 옮긴 유니크 스위칭 장비 이름의 접두어, 등록 부위 상한(`switching`)입니다.
목록은 세 파일로 나뉩니다. `data/equipment-variants.dfragon.json`은 점수 엔진 저장소의 같은 이름 파일(그 저장소의 packages/dnfscore-native/tools/equipment_variants 아래)을 그대로 복사한 파일이며 손으로 고치지 않습니다.
`data/equipment-variant-ids.json`은 제품이 운영에서 관측한 세트별 `setItemId`와 장비, 서약 본체, 광휘 결정, 무기(`weapons`, 무기 종류와 이름별)의 itemId, 관측 수(`count`)를 관리하는 파일입니다.
itemId가 없는 선택지는 목록에서 빠지고, 해방 계열 무기는 해방 아이템과 `억압 - ` 아이템의 itemId가 모두 있어야 선택지가 됩니다.
`src/equipment-variants.json`은 두 파일에서 선택지에 필요한 값만 뽑은 생성 파일이며 `pnpm --filter @dfragon/lib generate:equipment-variants`로만 만듭니다.
엔진 파일이나 대응 파일을 바꾸면 `pnpm format`을 실행하고 생성 명령을 다시 실행한 뒤 `pnpm --filter @dfragon/lib test`를 실행합니다.

`@dfragon/lib/avatar-presets`는 장비 시뮬레이터의 아바타 끝 스펙(무기와 8부위 레어, 찬란한 엠블렘, 상의와 하의의 플래티넘 엠블렘, 피부의 찬란한 엠블렘)을 역할, 직업, 전직마다 둔 목록입니다. 남성 크루세이더 버퍼는 체력과 정신력 갈래가 있어 갈래마다 따로 둡니다.
목록은 두 파일로 나뉩니다. `data/avatar-preset-observed.json`은 제품이 운영에서 관측한 파일로, 명성 12만 이상 캐릭터를 역할, 직업, 전직마다 명성 순으로 200명씩 뽑아 최신 착용 아바타의 전직별 최빈값(옵션 문구, 소켓 색별 찬란한 엠블렘, 플래티넘 엠블렘 쌍, 피부 엠블렘)과 관측 수(`count`, `total`)를 둡니다.
남성 크루세이더 버퍼는 12부위 증폭 이름의 최빈값으로 주스탯을 가려 갈래마다 최빈값을 따로 둡니다.
`src/avatar-presets.json`은 관측 파일에서 선택에 필요한 값만 뽑은 생성 파일이며 `pnpm --filter @dfragon/lib generate:avatar-presets`로만 만듭니다.
관측 파일을 바꾸면 `pnpm format`을 실행하고 생성 명령을 다시 실행한 뒤 `test/avatar-presets.test.mjs`의 전직별 기대값을 맞추고 `pnpm --filter @dfragon/lib test`를 실행합니다.

## 던파 캐릭터명 검사

`validateDFNickname`과 `cp949Characters`는 이 저장소의 앱이 호출하지 않습니다. OCR 학습용 닉네임을 만드는 [dfragon-ocr](https://github.com/dungeon-and-dragon/dfragon-ocr)이 둘을 허용 문자 판정의 원본으로 복사해 쓰므로, 규칙을 바꿀 때는 그 저장소의 사본도 함께 갱신합니다.

## 화면 검출

공대창, HUD 파티 프레임, 마을 지구본 아이콘 검출 함수는 웹 앱의 캡처 검색이 씁니다. 프레임과 기준 이미지는 호출자가 준비하며, 패키지에는 게임 이미지나 플레이어 데이터가 없습니다. 마을 지구본 템플릿은 웹 앱의 [`town-indicator.png`](../../apps/web/src/features/capture-search/lib/screen-watch/town-indicator.png)입니다. 공대 행 판독의 측정 방법은 [오프라인 평가](../../apps/web/scripts/raid-row-evaluation/README.md)를 따릅니다.

## 개발 및 검증

```bash
pnpm --filter @dfragon/lib test
pnpm --filter @dfragon/lib lint
pnpm --filter @dfragon/lib format:check
```

`test`는 TypeScript build 뒤 Node 기본 test runner로 공개 export와 경계값을 검증합니다.

CP949 문자 표(`src/cp949-characters.ts`)는 `iconv-lite`로 생성합니다. 표를 갱신할 때는 `pnpm --filter @dfragon/lib generate:cp949` 후 `pnpm format`을 실행합니다. 생성 데이터의 라이선스 원문은 [`@dfragon/licenses`](../licenses/notices/lib/iconv-lite-LICENSE)에 있고, build가 `dist/notices`와 패키지 루트 `LICENSES`에 복사합니다. 라이선스 수집기가 패키지 위치를 찾도록 `./package.json`도 export합니다.
