# @dfragon/lib

API, 웹 앱에서 입력 규칙, DNF UI 좌표, 픽셀 계산을 재사용하는 공용 TypeScript 패키지입니다. 앱 source, React, Node 전용 runtime에 의존하지 않는 ESM과 선언 파일을 제공합니다.

소비 workspace의 `dependencies`에 `"@dfragon/lib": "workspace:*"`를 추가하고 `pnpm --filter @dfragon/lib build` 후 사용합니다. API의 build와 typecheck는 공용 패키지를 먼저 빌드합니다. 캐릭터명 검사와 DNF 계산 함수의 적용 범위는 아래 안내를 따릅니다.

## 값 모양 검사

```ts
import { isNonblankString, isRecord } from '@dfragon/lib/utils/shape-check'

isRecord({ a: 1 }) // true
isNonblankString('  ') // 공백만 있어 false
```

신뢰 경계를 넘어온 값이 정한 모양인지 확인합니다. 모든 검사는 순수 함수이며 값을 바꾸거나 형 변환하지 않습니다.

- `isRecord`는 `null`도 배열도 아닌 객체를 받고 키와 prototype은 보지 않습니다.
- `isFiniteNumber`는 NaN과 무한대를 거절합니다.
- `isNonblankString`은 공백만 있는 문자열을 거절하고, `textOrNull`은 이를 통과한 문자열은 그대로, 나머지는 `null`로 돌려줍니다.

## 조건 단언

```ts
import { assert } from '@dfragon/lib/utils/assert'
import { isRecord } from '@dfragon/lib/utils/shape-check'

assert(isRecord(value))
value.rows // 이 줄부터 value는 Record<string, unknown>
```

`assert(condition, failure?)`는 조건이 falsy이면 실패를 던지고, 통과하면 TypeScript가 이후 코드에서 조건을 참으로 보고 타입을 좁힙니다. 브라우저처럼 Node 전용 모듈을 쓸 수 없는 곳에서도 쓰도록 `node:assert`에 의존하지 않습니다.

- `failure`를 주지 않거나 문자열을 주면 그 message로 이 패키지의 `AssertionError`를 던집니다. 기본 message는 `'Assertion failed'`입니다.
- `Error`를 주면 그 객체를 그대로 던집니다.
- `() => Error` 함수를 주면 실패할 때만 호출해 돌려받은 오류를 던집니다. API 오류 응답처럼 계약된 실패를 던질 때는 이 형태를 써서, 통과할 때마다 오류 객체를 만들지 않게 합니다.

```ts
const invalidResponse = () => new NeopleSearchFailure('api')
assert(Array.isArray(body.rows), invalidResponse)
```

`./package.json`도 export하므로 빌드의 라이선스 수집기가 패키지 위치를 찾을 수 있습니다. 기존 CP949 원문은 `dist/notices`에 유지하고 패키지 루트 `LICENSES`에도 복사해 배포합니다.

## Port 검사

```ts
import { parsePort } from '@dfragon/lib/port'

parsePort('3000') // 3000
```

`parsePort`는 ASCII 십진 정수 1~65535만 받고, 누락, 공백, 부호, 소수, 범위 밖 값은 `Invalid server configuration`을 던집니다.
API의 `PORT`와 `@dfragon/database`의 `DB_PORT`가 같은 규칙을 씁니다.

## 캐릭터 검색어 정책

`matchesDNFSearchNicknamePolicy(nickname)`는 검색어의 Unicode 코드 포인트 수 2~12와 앞뒤 공백 금지를 함께 검사합니다. `DNF_SEARCH_NICKNAME_LIMITS`가 두 길이 경계의 원본입니다. 문자열을 trim, 정규화하지 않고 내부 공백과 분해 문자, 이모지 sequence의 기존 의미를 유지합니다.

API 검색 query, 웹 앱의 검색 관측, 수동 입력 화면이 이 함수를 공유합니다. 함수의 보장은 길이, 공백 정책에 한정됩니다. API의 엄격한 URL/UTF-8 decode와 웹 앱의 `isWellFormed()` 검사는 각 입력 경계에 남아 있습니다. 아래 CP949 기반 캐릭터명 생성 검사를 대체하지 않습니다.

## 던파 캐릭터명 검사

```ts
import { validateDFNickname, type NicknameValidationResult } from '@dfragon/lib'

const result: NicknameValidationResult = validateDFNickname('★검신★')
if (!result.isValid) {
  console.log(result.reason)
}

// 서비스가 실제로 관리하는 목록이 있을 때만 지정합니다.
validateDFNickname('MyGM', { bannedWords: ['gm'] })
```

## 검사 범위

`validateDFNickname(nickname: string, options?)`는 던파 캐릭터명에 사용할 **CP949 기반 로컬 형식 검사**입니다. 게임 내 생성 가능 여부, 이름 중복, 공식 금칙어 판정은 제공하지 않습니다. 문자열 타입 검사는 HTTP, IPC 등 입력 경계에서 수행합니다.

이 저장소의 앱은 이 함수를 호출하지 않습니다. OCR 학습용 닉네임을 만드는 [dfragon-ocr](https://github.com/dungeon-and-dragon/dfragon-ocr)이 이 함수와 `cp949Characters`를 허용 문자 판정의 원본으로 복사해 쓰므로, 규칙을 바꿀 때는 그 저장소의 사본도 함께 갱신합니다.

- 빈 문자열, 공백만 있는 입력, 내부/앞뒤 Unicode 공백을 거절합니다.
- 인쇄 가능한 ASCII는 1바이트, CP949로 손실 없이 표현되는 비ASCII 문자는 2바이트로 계산하며 최대 12바이트를 허용합니다. 비어 있지 않은 1바이트 이름도 형식상 통과합니다. 이 최소 길이, 12바이트 상한은 요청한 로컬 정책이며 현재 게임 서버에서 검증한 계약이 아닙니다.
- 제어문자, format 문자, Unicode default-ignorable 문자(한글 채움 문자, ZWJ, variation selector 등)는 CP949 여부와 별도로 거절합니다. CP949에 없는 이모지, 보조 평면 문자, 단독 surrogate도 거절합니다. 예전 기호인 `★`, `♡` 등은 유지합니다.
- 문자열을 trim, NFC/NFKC, 대소문자 변환해 반환하지 않습니다. 금칙어 비교에서만 소문자화합니다.
- `bannedWords`는 선택적 읽기 전용 배열이며 대소문자를 무시한 부분 문자열 검사입니다. 빈 항목은 무시합니다. `운영자`, `세리아`, `단진`을 공식 금칙어로 하드코딩하지 않습니다.
- 오류 우선순위는 빈 값 → 공백 → 문자 집합 → 바이트 길이 → 전달된 금칙어입니다. 성공은 `{ isValid: true }`, 실패는 `{ isValid: false, reason: string }`입니다.

## 도메인 근거와 한계

[네오플의 2018년 검색 API 공지](https://developers.neople.co.kr/contents/notice/view/106)는 `wordType=full` 검색의 2~12자를 안내합니다. 검색어 길이는 캐릭터명 생성의 인코딩, 바이트 상한과 다른 계약입니다. 던삐삐 검색 규칙은 Unicode code point 기준 2~12자입니다. 이 함수로 검색 validator를 대체하면 기존 동작을 깨뜨립니다.

[과거 던파 공식 생성 안내](https://df.nexon.com/community/news/notice/118741)는 일부 ASCII 기호, 완성형 한글, 한문, 히라가나를 열거합니다. 이는 CP949 전체와 동일한 목록이 아니며, 오래된 공지만으로 현재 허용 문자 전체를 확정할 수 없습니다. 이 함수는 요청한 고전 특수문자 지원을 위해 인쇄 가능한 ASCII 및 CP949 문자 집합을 채택한 근사 검사입니다. 실제 생성, 검색 성공을 보장하지 않습니다.

CP949는 Unicode 한자 전체를 지원하지 않습니다. `검신〆`의 `〆`와 `아라드郎`의 `郎`는 CP949에 없으므로 거절합니다. 모양이 비슷한 `郞`는 별개의 문자로 CP949에 있어 `아라드郞`는 8바이트로 통과합니다. `★검신★`는 8바이트로 통과하고 `사쿠라🌸`는 거절합니다. 자동으로 유사 문자를 치환하지 않습니다.

## 개발 및 검증

```bash
pnpm --filter @dfragon/lib test
pnpm --filter @dfragon/lib lint
pnpm --filter @dfragon/lib format:check
```

`test`는 먼저 TypeScript build를 수행하고 Node 기본 test runner로 공개 package export와 경계값을 검증합니다. `src/cp949-characters.ts`는 `iconv-lite@0.7.3`의 CP949 encode/decode 왕복 결과에서 생성했습니다. 한글 완성형 전체는 연속 범위로 처리합니다. `iconv-lite`는 개발 의존성이며 앱 bundle에는 포함되지 않습니다. 생성 데이터의 라이선스는 [`@dfragon/licenses`의 원문](../licenses/notices/lib/iconv-lite-LICENSE)과 build 산출물 `dist/notices/iconv-lite-LICENSE`에 보존합니다.

문자 표를 갱신할 때는 `pnpm --filter @dfragon/lib generate:cp949` 후 root에서 `pnpm exec biome format --write packages/lib/src/cp949-characters.ts`를 실행합니다. 테스트는 BMP 전체에 대해 원본 codec과 표의 일치를 검증합니다.

## 12인 공대창 검출, 크롭

`detectDNFRaidParticipantWindow(frame, headingTemplate)`은 공대창의 위치, 배율과 12행의 참가 여부, 닉네임, 파티 표식, 장비 점수 영역을 반환합니다. `cropDNFRaidParticipantNicknames(frame, headingTemplate)`은 같은 프레임에서 참가 행의 닉네임 원본 RGBA도 복사합니다. 닉네임 OCR이나 이미지 수집, 업로드를 실행하지 않습니다.

공대원이 나가면 아래 행이 위로 당겨집니다. 결과의 `row`는 해당 프레임의 화면 위치(1~12)이며 이전 프레임의 같은 행과 같은 캐릭터라는 뜻이 아닙니다. 결과는 항상 12행이며 빈 행은 `occupied: false`, `nicknameCrop: null`입니다. 별도 8인 레이드 레이아웃은 지원 범위 밖입니다.

```ts
import { cropDNFRaidParticipantNicknames, type DNFParticipantFrame } from '@dfragon/lib'

// 호출자가 원본 game client와 공대창 기준 헤더를 RGBA로 준비합니다.
declare const frame: DNFParticipantFrame
declare const raidHeadingTemplate: DNFParticipantFrame

const result = cropDNFRaidParticipantNicknames(frame, raidHeadingTemplate)
if (result.status === 'found') {
  for (const row of result.rows) {
    if (row.nicknameCrop === null) continue
    // row.nickname은 client 기준 좌표, nicknameCrop은 독립된 원본 픽셀입니다.
    console.log(row.row, row.nickname, row.nicknameCrop.width, row.nicknameCrop.height)
  }
}
```

파티 구분과 장비 점수 판독은 `readDNFRaidParticipantMetadata(frame, rows, templates)`로 별도 실행합니다. 호출자가 준비한 표식, 글자 기준 이미지와 행별 픽셀에서 `party`, `equipmentScoreText`를 반환하며 판독할 수 없는 필드는 `null`입니다. R/Y/G, 싱글을 행 번호로 추정하지 않고, 점수는 `1000.4K` 같은 표시 문자열을 유지합니다. 정답 저장, 화면 연결은 하지 않습니다. 파티 표식 기준 없이 수치만 읽을 때는 `readDNFRaidParticipantValues(frame, rows, glyphs)`가 같은 판독 규칙으로 행별 `{ row, valueText }`를 반환합니다. 같은 칸은 게임에서 명성으로 바뀔 수 있어, `classifyDNFRaidValueColumn`이 검출 결과의 `valueHeadingRegion`을 기준 열 제목과 비교해 `fame`, `equipment-score`, `unknown`을 정합니다. 표시 문자열은 `parseDNFRaidValueNotation`이 보일 수 있는 정수 범위 `{ min, max }`로 바꿉니다(`1000.4K`는 1,000,400~1,000,499). 행의 `jobRegion`은 직업명 칸 좌표이며 OCR은 하지 않습니다.

웹 앱의 공대 캡처가 이 함수들을 씁니다. 창 검출 기준 헤더, 파티 표식, 수치 글자와 열 제목 기준 이미지는 호출자가 보관, 디코딩하며 라이브러리에 게임 이미지나 플레이어 데이터를 포함하지 않습니다.

### 입력과 좌표

두 입력은 `{ width, height, rgba }`이며 `rgba`는 행 우선의 premultiply하지 않은 `Uint8Array | Uint8ClampedArray`입니다. 정확히 `width × height × 4`바이트를 요구하며 원본 alpha를 보존합니다. 게임 client는 양의 정수 크기, 한 변 8192px 이하, 총 33,000,000픽셀 이하를 받습니다. 특정 해상도 일치 조건은 없으며 모든 크기와 팝업 배율을 실제 게임에서 검증한 것은 아닙니다.

기준 헤더는 UI 0%의 `423 × 18` RGBA로, 파티, 레벨, 장비 점수, 캐릭터 이름, 직업명 및 오른쪽 빈 열의 배경과 구분선을 포함합니다. 수치 열 제목이 "명성"인 화면에서도 이 기준 헤더로 창을 찾습니다. 1067×600 표본에서 명성 화면 5장의 `matchScore`는 0.872, 장비 점수 화면 12장은 0.999로, 최종 상관 기준 0.68을 넘었습니다. 그래서 기준 헤더 비교에서 열 제목 영역을 빼지 않았습니다. 입력 크기, 바이트 길이가 잘못됐거나 기준 헤더에 대비가 없으면 `RangeError`를 던집니다.

다음은 헤더 좌상단을 원점으로 한 UI 0% 관측값입니다. 오른쪽, 아래쪽 경계는 포함하지 않습니다.

| 대상 | 기준 좌표 |
| --- | --- |
| 팝업 외곽 | 왼쪽 −15, 위 −68, 오른쪽 450, 아래 324: `465 × 392` |
| 빨간 기준 아이콘 중심 | `(405, −10)` |
| 행 시작 | `y = 18 + 21 × (row − 1)` |
| 닉네임 | `x = 182..268`, `y = 행 시작 + 3..20`: `86 × 17` |
| 파티 표식 | `x = 3..45`, `y = 행 시작 + 2..19`: `42 × 17` |
| 수치(명성 또는 장비 점수) | `x = 106..181`, `y = 행 시작 + 3..20`: `75 × 17` |
| 직업명 | `x = 282..349`, `y = 행 시작 + 3..20`: `67 × 17` |
| 수치 열 제목 | `x = 105..180`, `y = 0..18`: `75 × 18` |

직업명 칸은 역할 배지(D, B, S) 오른쪽의 `眞` 표식부터 돋보기 아이콘 앞까지입니다. 긴 직업명은 줄임표 없이 돋보기 앞에서 글자 중간이 잘리며, 1067×600 표본에서 `데몬슬레이어`는 다섯 글자, `소드마스터`는 네 글자와 잘린 `터`가 보였습니다. 수치 열 제목 칸은 열 제목 글자와 전환 아이콘, 칸 배경을 포함합니다.

닉네임, 파티, 수치, 직업명, 열 제목 사각형은 입력 client 기준 좌표입니다. 배율을 적용한 각 모서리를 파티원창과 같은 ties-to-even 규칙으로 반올림하며, 행 간격을 먼저 반올림해 누적하지 않습니다. 각 모서리의 투영은 [`projectParticipantRectangle`](src/dnf-participant-regions.ts)을 파티원창과 공유하고, 공대창 고유 외곽, 열, 12행 좌표와 아래 행이 당겨지는 의미는 공대창 모듈에 둡니다.

검출은 빨간 연결 영역과 헤더 정규화 상관 함수를 파티원창과 공유하며 헤더 치수와 아이콘 위치를 공대창에 맞춥니다. 팝업 전체 경계와 12행 구분선으로 후보를 먼저 좁히고 초상화, 레벨, 역할 아이콘 근거로 참가 여부를 판단합니다. 참가 판정의 밝기, 색상 경계와 세 근거 중 두 개 이상이라는 규칙은 [공통 참가 근거 정책](src/dnf-participant-evidence.ts)으로 파티원창과 같고, 12행 위치나 행 이동 의미는 공유하지 않습니다. 배율 후보는 0.0025 간격으로 21개이며, 후보 128개와 프레임당 비교 표본 64,000,000개의 탐색 한도를 넘으면 앞에서 찾은 후보도 부분 성공으로 반환하지 않고 `search-limit`입니다. 원본 RGBA와 alpha는 판정에서도 바꾸지 않습니다.

### 파티, 수치 판독

`readDNFRaidParticipantMetadata(frame, rows, templates)`에 검출 결과의 행과 같은 프레임을 전달하면 행별 `{ row, party, equipmentScoreText }`를 반환합니다. 이름은 장비 점수지만 같은 칸의 명성 표기도 같은 글자 기준으로 읽으며, 어느 값인지는 아래 열 종류 판별로 정합니다. `party`는 `R`, `Y`, `G`, `싱글` 중 하나이며, 각 필드의 미판독과 빈 행은 `null`입니다. 빈 행과 참가 행의 미판독은 원래 행의 `occupied`로 구분합니다. 닉네임 크롭과 판독 결과를 합치는 일은 호출자가 담당합니다.

`DNFRaidMetadataTemplates`는 호출자가 준비하는 다음 기준 이미지입니다. 라이브러리가 기준 데이터를 내려받거나 모델을 학습하지 않습니다.

- `parties`: `{ party, image }` 배열. UI 0%의 표식 영역 전체인 `42 × 17` RGBA를 사용합니다.
- `equipmentScoreGlyphs`: `{ character, image }` 배열. 문자 하나의 폭 1~16, 높이 17 RGBA를 사용하며 `0`~`9`, 쉼표, 소수점, 대문자 `K`를 구분합니다. 문자 전체 획과 점수 영역 안의 세로 위치를 보존해야 하며 가로 여백은 허용합니다.

판독은 필드의 사본을 기준 크기로 맞춰 수행하며 원본을 바꾸지 않습니다. 확대된 필드는 원래 픽셀 중심 위치를 쌍선형으로 표본해 맞춥니다. 파티는 색상과 표식 패턴을 비교하고, 점수는 국소 대비로 글자 획을 분리해 기준 글자와 비교합니다. 기준 이미지, 행 번호, 영역 경계는 검증하며 잘못된 입력은 `RangeError`로 거절합니다. 기준 글자에 없는 문자나 불확실한 필드를 임의의 숫자, 파티로 채우지 않습니다.

[메타데이터 모듈](src/dnf-raid-metadata.ts)의 배지 판정은 정규화 상관도 0.8 이상과 후보 간 차이 0.06 이상을, 점수 판정은 국소 대비 55 이상, 문자 획의 교집합/합집합 겹침 점수 0.8 이상과 후보 간 차이 0.08 이상, 최대 16문자를 요구합니다. 두 0.8은 서로 다른 점수이며 어느 쪽도 판독 성공 확률이 아닙니다.

### 수치 열 종류와 표기

[수치 열 모듈](src/dnf-raid-value-column.ts)이 두 순수 함수를 제공합니다. 화면 캡처, 디코딩, 저장, 네트워크 요청은 하지 않고 프레임을 바꾸지 않습니다.

`classifyDNFRaidValueColumn(frame, valueHeadingRegion, templates)`는 수치 열 제목 칸의 사본을 `75 × 18`로 맞춘 뒤, 호출자가 준비한 UI 0% "명성", "장비 점수" 기준 칸(`templates.fame`, `templates.equipmentScore`)과 회색조 정규화 상관을 비교해 `fame`, `equipment-score`, `unknown`을 반환합니다. 높은 쪽 상관이 0.7 이상이고 두 상관의 차이가 0.15 이상일 때만 종류를 고르고, 아니면 `unknown`입니다. 1067×600 표본 17장에서 같은 종류 기준과의 상관은 1.000, 다른 종류는 0.395였습니다. 확대 화면의 실표본이 없어 기준을 표본값보다 낮게 두었습니다. 기준 칸 크기나 대비, 영역 경계가 잘못되면 `RangeError`를 던집니다.

`parseDNFRaidValueNotation(text)`는 판독 문자열을 그 표기로 보일 수 있는 정수 범위 `{ min, max }`(양 끝 포함)로 바꿉니다.

| 표기 | 결과 |
| --- | --- |
| `12,345`, `2212` | 값 그대로 (`min`과 `max`가 같음) |
| `1000.4K`, `1,000.4K` | 1,000,400 ~ 1,000,499 |
| `1000K` | 1,000,000 ~ 1,000,999 |
| `1.234K` | 1,234 ~ 1,234 |

쉼표는 세 자리 묶음이 온전할 때만 받고, 소수점은 `K`와 함께 소수 세 자리까지만 받습니다. 게임이 `K` 표기에서 보이지 않는 자리를 버린다고 가정한 범위이며, 실제 `K` 표기 화면은 아직 확인하지 못했습니다. 다른 형식이나 안전한 정수 범위를 넘는 값은 추측하지 않고 `null`입니다.

### 검증 자료와 한계

[공대창 합성 테스트](test/dnf-raid-participants.test.mjs)는 이동, 배율, 인원 감소, 빈 행, 원본 픽셀 보존, 모호 후보, 잘린 창, 탐색 한도를 확인합니다. [메타데이터 합성 테스트](test/dnf-raid-metadata.test.mjs)는 R/Y/G, 싱글, 색상이 다른 점수, 쉼표, 소수점, K, 확대, 미판독, 모호한 기준 이미지, 잘못된 입력을 확인합니다.

실제 화면은 1067×600(검출 배율 1.0)과 1920×1080(검출 배율 1.8) 로컬 표본으로 확인했습니다. 실제 플레이어 데이터와 원본 화면은 저장소, CI에 포함하지 않습니다. 기준 헤더, 표식과 열 제목 기준을 같은 표본에서 추출했으므로 이 확인을 독립 데이터셋의 정확도로 해석하지 않습니다. K 표기의 실제 게임 화면, 1920×1080 명성 열, 다른 client 크기와 배율 조합, 별도 8인 레이드 창, 가림, 게임 UI 변경, Windows DPI 조합, 설치본은 별도 검증 대상입니다. 공대 행 판독의 측정 방법과 표본 결과는 [오프라인 평가](../client-core/scripts/raid-row-evaluation/README.md)를 따릅니다.

## HUD 파티 프레임 검출

`detectPartyFrameGeometry({ width, height, rgba })`는 HP, MP가 가득 찬 HUD 프레임과 주변 경계를 찾아 `scale`, `slots`를 반환합니다. 각 슬롯은 1~4번 번호와 원본 닉네임 크롭 좌표, 가림 확인용 `coverage`를 포함합니다. 누락된 슬롯은 채우지 않으며 미검출, 모호한 후보, 잘못된 입력은 `PartyFrameGeometryError`의 `reason`으로 구분합니다. 웹 앱의 OCR 캡처가 이 함수를 사용합니다.

`rgba`는 행 우선 RGBA `Uint8Array`이며 정확히 `width × height × 4`바이트여야 합니다. Canvas의 `Uint8ClampedArray`는 같은 buffer를 보는 `Uint8Array`로 전달할 수 있습니다. `isValidPartyFrameSize(width, height)`는 양의 안전한 정수, 한 변 8192px 이하, 총 33,000,000픽셀 이하를 확인합니다. 특정 해상도 일치 조건은 없으며, 호출자가 창 테두리를 제외한 게임 client 원점의 픽셀을 제공해야 합니다.

검출기는 화면에서 관측한 래스터 배율을 사용하며 UI 설정 퍼센트를 역산하지 않습니다. HP, MP 잔량이 줄어든 전투 화면, 폰트 변경, 모든 장식의 정확도는 보장하지 않습니다. 웹 앱의 캡처는 붙여 넣거나 공유한 회차 프레임 한 장에서 이 함수가 검출한 위치만 원본 크기로 자릅니다.

### 배율과 관측값

게임 영역 크기는 실행 중인 DNF 창의 [`GetClientRect`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclientrect)로 읽었습니다. 설정 파일, 레지스트리, 프로세스 메모리는 사용하지 않았습니다. 아래 배율은 관측 결과에 맞춘 후보식입니다. `H`는 client 높이(px), `u`는 UI 설정값을 0~1로 바꾼 값입니다.

`s = H / (H × (1 − u) + 600 × u)`

| Client 크기 | UI 설정 | 후보 배율 |
| --- | ---: | ---: |
| 1513×851 | 0% | 1 |
| 1920×1080 | 0% | 1 |
| 1920×1080 | 50% | 1.285714 |
| 1920×1080 | 100% | 1.8 |
| 1600×900 | 50% | 1.2 |
| 1067×600 | 50% | 1 |

1513×851과 1920×1080의 UI 0% 관측, 그리고 1067×600의 UI 50% 관측에서 HP, MP track은 같은 픽셀 영역에 나타났습니다. UI 설정이 다른 조건에서는 track 위치와 간격이 후보 배율에 가까웠습니다. 확대 과정의 보간과 정수 픽셀 경계 때문에 색이 채워진 부분의 폭은 배율과 정확히 비례하지 않았고, 실제 검출 배율은 1.28~1.30처럼 관측됩니다. 이 식은 표본으로 추정한 값이며 게임 내부 공식이나 미측정 조건에 대한 보장은 아닙니다. client 높이가 600px이면 모든 UI 설정에서 배율 1이므로 배율에서 UI 퍼센트를 역산할 수 없습니다.

프레임 장식은 파티원 각자의 설정에 따라 달라집니다. 1920×1080 스크린샷 세 장의 네 track 가로 시작점 간격은 171~182px로 장식에 따라 달랐으므로, 고정 간격으로 외삽하지 않고 각 HP, MP track을 독립 검출합니다. 검출기는 RGB 원문을 그대로 비교하지 않고 HP, MP 색 분류, 세로 중심과 간격, 가로 폭, 주변 경계의 어두운 픽셀 비율을 함께 비교합니다. 색 띠는 다른 색 픽셀이 배율 1 기준 2px 이하로 끼어도 이어 보지만, 어두운 테두리 픽셀에서는 끊습니다. 2026-10-31 실기의 마을 밤하늘처럼 테두리 바로 바깥 배경이 MP나 HP 색으로 분류되면, 막대와 배경이 한 띠로 이어져 폭이 맞지 않아 미검출이 됐기 때문입니다. 파티 번호는 누락된 프레임을 앞으로 당겨 붙이지 않도록 서로 겹치지 않는 넓은 위치 범위로 식별하며, 실제 크롭의 가로 위치는 검출한 HP, MP 시작점으로만 정합니다.

### 이름 크롭 영역

이름 영역은 검출한 배율 `s`로 `x=관측 시작점`, `y=floor(12s)−2`, `width=ceil(72.5s)`, `height=ceil(12s)+4`입니다. 1067×600과 FHD 표본의 글자, 외곽선이 경계 안에 들어오는 것을 확인했고, 세로 여백이 좁다는 피드백에 따라 위아래 각각 원본 화면 기준 2px을 더했습니다. 추가 여백은 UI 배율과 무관하게 고정 2px입니다. 최대 길이 이름은 아직 검증하지 않았습니다.

### 검증 범위와 한계

지원 범위는 파티 결성 중 HP, MP가 가득 찬 화면입니다. 가득 찬 색 띠와 테두리를 함께 확인하며 조건에 맞지 않는 프레임은 미검출로 둡니다. 해상도 확대 사례는 합성 픽셀로 검증하며, macOS Electron의 실제 3840×2160 합성 창 캡처에서 네 닉네임 OCR을 확인했습니다. 대화형 실측은 self frame과 두 명이 보이는 상태까지이고, 추가 FHD 스크린샷에서 세 번째, 네 번째 위치를 확인했습니다. 긴 닉네임의 crop 경계, HP, MP 잔량 변화, UI 효과, 가림, client 크기 변경, 창 배치와 DPI 조합, QHD와 4K 실제 게임은 검증하지 않았습니다. 후속 보정 항목은 [Issue #1025](https://github.com/dungeon-and-dragon/dfragon/issues/1025)에 있습니다.

## 마을 지구본 아이콘 검출

`detectDNFTownIndicator(frame, template)`는 게임 화면 오른쪽 위, 채널명 오른쪽의 노란 지구본 아이콘을 찾아 마을인지 판정합니다. 웹이 던파 창을 공유하는 동안 약 1초마다 하는 마을 판정을 위한 함수입니다. 화면 캡처, 디코딩, 저장은 하지 않고 프레임을 바꾸지 않습니다.

```ts
import { detectDNFTownIndicator, type DNFParticipantFrame } from '@dfragon/lib'

declare const frame: DNFParticipantFrame
declare const townIndicatorTemplate: DNFParticipantFrame

const result = detectDNFTownIndicator(frame, townIndicatorTemplate)
if (result.status === 'found') {
  console.log(result.scale, result.matchScore, result.region)
}
```

결과는 `found`와 `not-found` 둘입니다. `found`는 검출 배율 `scale`, 상관 점수 `matchScore`, 프레임 좌표의 아이콘 영역 `region`을 함께 줍니다.

### 입력과 템플릿

프레임은 공대창 검출과 같은 `{ width, height, rgba }`이며 크기, 바이트 길이 조건도 같습니다. 템플릿은 UI 배율 1의 아이콘 고리 안쪽 `16 × 16` RGBA이며, 웹 entry가 [`town-indicator.png`](../client/src/site/web/town-indicator.png)로 보관합니다. 고리 바깥은 배경이 비쳐 화면마다 달라서 템플릿에 넣지 않았습니다. 입력 크기, 바이트 길이가 잘못됐거나, 템플릿이 `16 × 16`이 아니거나, 템플릿의 밝기나 노란색 채널에 대비가 없으면 `RangeError`를 던집니다.

템플릿은 저장소 소유자가 로컬로 제공한 1067×600 스크린샷 17장(마을 15장, 공대 대기실 2장)의 같은 자리 픽셀 중앙값입니다. 표본은 게임 스크린샷 기능의 JPG라 실제 화면 공유 프레임과 압축 손실이 다릅니다. 정규화 상관은 밝기, 대비 차이에 영향을 받지 않지만 압축으로 생긴 픽셀 차이는 점수를 낮춥니다. 원본 스크린샷은 저장소에 넣지 않았습니다.

### 위치와 판정

UI 배율 1에서 지구본 고리는 `23 × 23`이고, 화면 오른쪽 끝에서 3px, 위에서 2px 떨어져 있습니다. 템플릿 영역의 왼쪽 위는 오른쪽 끝에서 23px, 위에서 5px이며, 이 두 거리는 표본에서 배율에 비례해 커졌습니다.

- 배율 후보는 템플릿 크기 16~29px이며, 크기를 16으로 나눈 1~1.8125입니다. 파티 프레임 검출이 관측한 1~1.8을 덮습니다.
- 크기마다 오른쪽 위 기준 예상 위치(`오른쪽 끝 − 23 × 배율`, `위 5 × 배율`)의 상하좌우 3px만 비교합니다. 그래서 오른쪽 위 밖에 있는 같은 그림은 찾지 않고, 홀수 폭 client(1067)를 한 열 줄인 1066 폭 공유 프레임도 같은 위치로 찾습니다.
- 정규화 상관은 공대창 헤더 검색과 같은 함수(`headingPattern`, `headingScore`)로 밝기 채널과 노란색 채널(`max(0, min(R, G) − B)`)에서 각각 계산합니다. 두 상관 중 낮은 값이 가장 높은 위치를 고르고, 그 값이 0.7 이상이면 `found`입니다.
- 상관은 밝기의 크기를 보지 않으므로, 고른 위치의 노란색 채널 평균이 템플릿 노란색 채널 평균의 0.5배 이상이어야 `found`입니다. 회색 지구본은 화면 공유의 색 흔들림(1~3)만으로도 노란색 모양이 비례해 상관을 통과할 수 있기 때문입니다. 던전 결과 표본의 R, G만 1.01배로 바꾸면 이 조건 없이 상관이 0.725까지 올라 `found`가 됐습니다.
- 노란색 채널을 함께 보는 이유는 던전 결과 화면(`Continue?` 선택 화면)이 같은 자리에 같은 모양의 회색 지구본을 보이기 때문입니다. 밝기 상관만 쓰면 아래 표본의 던전 결과 화면 7장이 0.958~0.998로 마을과 구분되지 않았습니다.

비교 영역이 프레임 크기와 무관하게 오른쪽 위 44 × 41px 이하라 Apple M3 Max의 Node에서 1066×600, 3840×2160 모두 한 번에 약 1.8 ms(중앙값)였습니다.

### 표본 관측값

저장소 소유자의 Windows PC 스크린샷 72장으로 확인했습니다. 그중 11장은 게임 스크린샷 기능이 분리한 채팅 창까지 찍은 것이라, 게임 화면만 잘라 넣었습니다. 화면 공유 프레임에는 채팅 창이 빠지고 게임 화면만 들어온다고 저장소 소유자가 확인했습니다(2026-11-03). 게임 화면과 채팅 창 사이에는 거의 검은 1px 열이 있어 자르는 경계가 분명했습니다. UI 설정값은 파일에 기록되지 않아 적지 않고, 검출 배율과 템플릿 영역의 오른쪽 위 기준 거리를 적습니다.

| 해상도 | 검출 배율 | 오른쪽, 위 거리(px) | 장 수 | `matchScore` |
| --- | ---: | --- | ---: | --- |
| 1067×600 | 1 | 23, 5 | 21 | 0.983~0.999 |
| 1314×739(잘라 냄) | 1.25 | 28, 6 | 4 | 0.917 |
| 1561×878(잘라 냄) | 1.5 | 34, 7 | 3 | 0.928 |
| 1600×900 | 1.1875 | 28, 6 | 2 | 0.907 |
| 1920×1080 | 1 | 23, 5 | 6 | 0.954~0.956 |
| 1920×1080 | 1.3125 | 30, 6 | 12 | 0.935~0.942 |
| 1920×1080 | 1.75~1.8125 | 41, 9 | 9 | 0.894~0.922 |
| 2560×1440 | 1.375 | 32, 7 | 1 | 0.926 |
| 3840×2160 | 1.8125 | 42, 9 | 1 | 0.905 |

위 59장은 마을 47장(잘라 낸 11장 포함)과 공대 대기실(레이드 입장 전 카운트다운 화면) 12장이며 모두 `found`입니다. 1067×600 행의 21장 중 4장이 잘라 낸 것입니다. 공대 대기실도 채널명과 같은 노란 지구본을 보입니다. 스크린샷 그대로인 1067×600 22장을 오른쪽 한 열을 잘라낸 것과 가로로 줄인 것, 두 가지 1066×600으로 바꿔도 판정이 같았고, `found` 17장의 점수는 0.982~0.999였습니다.

`not-found`여야 하는 표본의 가장 높은 `matchScore`는 다음과 같습니다. 임계값 0.7은 `found` 최저값 0.894와 `not-found` 최고값 0.192 사이에 있습니다.

| 화면 | 장 수 | 최고 `matchScore` |
| --- | ---: | ---: |
| 던전 전투(오른쪽 위에 미니맵과 진행률) | 6 | 0.126 |
| 던전 결과(회색 지구본) | 7 | 0.192 |

노란색 강도 비율(고른 위치의 노란색 평균 ÷ 템플릿 노란색 평균)은 다음과 같습니다. 하한 0.5는 두 분포 사이에 있습니다.

| 화면 | 장 수 | 노란색 강도 비율 |
| --- | ---: | --- |
| 마을 | 47 | 0.954~1.065 |
| 공대 대기실 | 12 | 0.956~1.059 |
| 던전 결과(회색 지구본) | 7 | 0.001~0.010 |
| 던전 결과, 오른쪽 위 R, G를 1.01~1.05배 | 7 | 0.010~0.080 |

채팅 창이 붙은 스크린샷을 자르지 않고 넣으면, 프레임 오른쪽 위가 게임 화면의 오른쪽 위가 아니라서 11장 모두 `not-found`(최고 0.408)입니다. 화면 공유 입력과 모양이 달라 위 판정 표에서는 뺐습니다.

### 검증 자료와 한계

[합성 테스트](test/dnf-town-indicator.test.mjs)는 1067×600과 1066×600 검출, 배율 1.3과 1.8, 2.4배로 커진 아이콘, 회색 지구본, 색이 조금 흔들린 회색 지구본, 노란 부분만 같고 밝기 모양이 다른 그림, 오른쪽 위 밖의 같은 아이콘, 빈 화면과 작은 화면, 입력 검증을 확인합니다. 표본이 덮지 못한 배율은 이 합성 검증으로 둡니다. 템플릿과 임계값을 같은 표본에서 정했으므로 위 결과를 독립 데이터셋의 정확도로 해석하지 않습니다.

실제 화면 공유 프레임(영상 압축과 색 변환), 표본에 없는 배율, UI 효과나 다른 창의 가림, 게임 UI 변경은 검증하지 않았습니다. 배율은 1~1.8만 표본과 합성으로 확인했고 그 밖은 보장하지 않습니다. 실제 템플릿을 bilinear로 키운 합성 프레임에서는 1.9배가 0.925, 2배가 0.771로 `found`였고 2.2배부터 `not-found`였습니다. 파티 프레임의 후보 배율식으로는 client 높이가 1080을 넘고 UI 설정이 높으면 배율이 1.8을 넘을 수 있으며(3840×2160, UI 100%면 3.6), 그런 큰 배율의 화면은 마을이어도 `not-found`입니다.
