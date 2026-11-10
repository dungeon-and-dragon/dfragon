# @dfragon/lib

API, 웹 앱이 함께 쓰는 입력 규칙, DNF UI 좌표, 픽셀 계산 TypeScript 패키지입니다. 앱 source, React, Node 전용 runtime에 의존하지 않는 ESM과 선언 파일을 제공하며, OCR, 저장, 네트워크 요청은 하지 않습니다.

소비 workspace의 `dependencies`에 `"@dfragon/lib": "workspace:*"`를 추가하고 `pnpm --filter @dfragon/lib build` 후 사용합니다. API의 build와 typecheck는 이 패키지를 먼저 빌드합니다.

## 입력 검사

```ts
import { parsePort } from '@dfragon/lib/port'
import { assert } from '@dfragon/lib/utils/assert'
import { isRecord } from '@dfragon/lib/utils/shape-check'

assert(isRecord(body), () => new NeopleSearchFailure('api'))
parsePort('3000') // 3000
```

- `@dfragon/lib/utils/shape-check`: `isRecord`, `isFiniteNumber`, `isNonblankString`, `textOrNull`은 신뢰 경계를 넘어온 값의 모양만 확인하고 값을 바꾸지 않습니다.
- `@dfragon/lib/utils/assert`: `assert(condition, failure?)`는 조건이 falsy이면 `AssertionError`, 받은 `Error`, 또는 함수가 돌려준 오류를 던지고, 통과하면 이후 코드의 타입을 좁힙니다. `node:assert`에 의존하지 않습니다.
- `@dfragon/lib/port`: `parsePort`는 ASCII 십진 정수 1~65535만 받고 나머지는 `Invalid server configuration`을 던집니다. API의 `PORT`와 `@dfragon/database`의 `DB_PORT`가 씁니다.
- `matchesDNFSearchNicknamePolicy(nickname)`: 검색어가 Unicode code point 1~12개이고 앞뒤 공백이 없는지 확인합니다. 경계값은 `DNF_SEARCH_NICKNAME_LIMITS`에 있고 문자열을 trim, 정규화하지 않습니다.

## 던파 게임 값

`MALE_CRUSADER_DEALER_SKILL`(`용기의 은총`)은 남성 크루세이더를 딜러로 판정하는 스킬 이름입니다. API의 역할 판정과 `@dfragon/database`의 역할 SQL이 씁니다.

`SKILL_STYLE_SAMPLE_TOP_COUNT`(5000)는 API의 스킬 채택률 응답과 `@dfragon/database`의 표본 SQL이 함께 쓰는 표본 순위입니다.

## 던파 캐릭터명 검사

```ts
import { validateDFNickname } from '@dfragon/lib'

validateDFNickname('★검신★') // { isValid: true }
validateDFNickname('MyGM', { bannedWords: ['gm'] }) // { isValid: false, reason: '...' }
```

`validateDFNickname`은 CP949 문자 집합과 12바이트 상한으로 캐릭터명 형식을 검사합니다. 게임 내 생성 가능 여부, 이름 중복, 공식 금칙어는 판정하지 않으며 검색어 검사를 대신하지 않습니다.

이 저장소의 앱은 이 함수를 호출하지 않습니다. OCR 학습용 닉네임을 만드는 [dfragon-ocr](https://github.com/dungeon-and-dragon/dfragon-ocr)이 이 함수와 `cp949Characters`를 허용 문자 판정의 원본으로 복사해 쓰므로, 규칙을 바꿀 때는 그 저장소의 사본도 함께 갱신합니다.

## 12인 공대창 검출, 크롭

웹 앱의 공대 캡처가 쓰는 함수입니다. 프레임과 기준 이미지는 `{ width, height, rgba }` 형태의 `DNFParticipantFrame`이며 호출자가 준비합니다. 패키지에는 게임 이미지나 플레이어 데이터가 없습니다.

- `detectDNFRaidParticipantWindow(frame, headingTemplate)`: 공대창의 위치, 배율과 12행의 참가 여부, 닉네임, 파티 표식, 수치, 직업명 영역을 돌려줍니다.
- `cropDNFRaidParticipantNicknames(frame, headingTemplate)`: 위 결과에 참가 행의 닉네임 원본 RGBA를 더합니다.
- `readDNFRaidParticipantMetadata(frame, rows, templates)`, `readDNFRaidParticipantValues(frame, rows, glyphs)`: 행별 파티(`R`, `Y`, `G`, `싱글`)와 수치 표시 문자열을 읽고, 읽지 못한 필드는 `null`로 둡니다.
- `classifyDNFRaidValueColumn(frame, valueHeadingRegion, templates)`: 수치 열이 `fame`, `equipment-score`, `unknown` 중 무엇인지 정합니다.
- `parseDNFRaidValueNotation(text)`: `1000.4K` 같은 표기를 보일 수 있는 정수 범위 `{ min, max }`로 바꿉니다.

```ts
const result = cropDNFRaidParticipantNicknames(frame, raidHeadingTemplate)
if (result.status === 'found') {
  for (const row of result.rows) {
    if (row.nicknameCrop !== null) console.log(row.row, row.nickname, row.nicknameCrop.width)
  }
}
```

공대 행 판독의 측정 방법은 [오프라인 평가](../../apps/web/scripts/raid-row-evaluation/README.md)를 따릅니다.

## HUD 파티 프레임 검출

`detectPartyFrameGeometry({ width, height, rgba })`는 HP, MP가 가득 찬 HUD 파티 프레임을 찾아 배율 `scale`과 1~4번 슬롯의 닉네임 크롭 좌표를 돌려줍니다. 찾지 못하면 `PartyFrameGeometryError`의 `reason`으로 이유를 구분합니다. 프레임 좌상단을 게임 client 원점으로 보며, `isValidPartyFrameSize(width, height)`가 입력 크기 제한을 확인합니다.

## 마을 지구본 아이콘 검출

```ts
const result = detectDNFTownIndicator(frame, townIndicatorTemplate)
if (result.status === 'found') console.log(result.scale, result.matchScore, result.region)
```

`detectDNFTownIndicator(frame, template)`는 화면 오른쪽 위의 노란 지구본 아이콘을 `16 × 16` 템플릿으로 찾아 `found` 또는 `not-found`를 돌려줍니다. 템플릿은 웹 앱의 [`town-indicator.png`](../../apps/web/src/host/screen-watch/town-indicator.png)입니다.

## 개발 및 검증

```bash
pnpm --filter @dfragon/lib test
pnpm --filter @dfragon/lib lint
pnpm --filter @dfragon/lib format:check
```

`test`는 TypeScript build 뒤 Node 기본 test runner로 공개 export와 경계값을 검증합니다.

CP949 문자 표(`src/cp949-characters.ts`)는 `iconv-lite`로 생성합니다. 표를 갱신할 때는 `pnpm --filter @dfragon/lib generate:cp949` 후 root에서 `pnpm exec biome format --write packages/lib/src/cp949-characters.ts`를 실행합니다. 생성 데이터의 라이선스 원문은 [`@dfragon/licenses`](../licenses/notices/lib/iconv-lite-LICENSE)에 있고, build가 `dist/notices`와 패키지 루트 `LICENSES`에 복사합니다. 라이선스 수집기가 패키지 위치를 찾도록 `./package.json`도 export합니다.
