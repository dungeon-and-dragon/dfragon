# @dfragon/neople

Neople Open API(`api.neople.co.kr`)와 캐릭터 이미지 서버(`img-api.neople.co.kr`)를 부르는 package입니다.
`ky`, `zod` 의존성을 이 package가 갖고(`@dfragon/lib`에도 의존), API는 `"@dfragon/neople": "workspace:*"`로 공개 export만 씁니다.
이 package는 `apps/api`를 import하지 않습니다.

## 공개 export

- `createNeopleClient(apiKey)`: Neople Open API client를 만듭니다. 메서드마다 응답을 schema로 검증하고, schema에서 추론한 타입을 돌려줍니다.
  - `searchCharacters(serverId, query)`: 캐릭터 검색
  - `character(identity, section, signal)`: 캐릭터 기본 정보와 상세 섹션. 섹션 이름과 경로는 `NEOPLE_CHARACTER_SECTIONS`에 있습니다.
  - `characterBasic(identity, signal)`: 캐릭터 기본 정보. 레벨, 직업, 명성, 모험단, 길드까지 검증하며 모험단 이름이 없으면 `api` 실패입니다.
  - `characterTimeline(identity, query)`: 타임라인 한 페이지. 다음 페이지는 `{ next }`만 보냅니다.
  - `multiItems(itemIds, signal)`: 여러 아이템의 공용 상세. 행은 호출한 쪽이 고르도록 `unknown[]`로 돌려줍니다.
  - `itemShop(itemId, signal)`: 아이템의 오늘의 등급
  - `skill(jobId, skillId, signal)`: 스킬 상세
- `createNeopleImageClient()`: 이미지 서버 client를 만듭니다. `characterImage(identity, signal)`는 API key 없이 PNG를 받아 `ArrayBuffer`로 돌려줍니다.
  `Content-Type`이 `image/png`가 아니거나 본문이 4MiB를 넘으면 실패합니다.
- `neopleCharacterImageUrl(identity)`: 캐릭터 이미지의 고정 URL을 만듭니다.
- `NeopleRequestFailure`: 모든 실패를 이 오류로 던집니다. `kind`는 `internal`, `api`, `unavailable`, `timeout` 가운데 하나입니다.
  JSON 파싱 실패와 연결 오류는 원래 오류를 `cause`로 갖습니다. `cause`에는 정제하지 않은 오류가 남으므로 응답이나 로그로 그대로 내보내지 않습니다.
- `createNeopleClientForTest(apiKey, { fetch, origin })`, `createNeopleImageClientForTest({ fetch })`: 테스트에서 `fetch`와 origin을 바꿉니다.
  운영 origin은 고정이고, 이 함수는 테스트에서만 씁니다.

## 요청과 실패

- 모든 요청은 redirect를 따라가지 않고(`redirect: 'error'`), 자동 retry가 없으며, ky의 기본 timeout을 씁니다.
- Neople 오류 body의 code를 먼저 분류하고, code가 없거나 모르는 값이면 HTTP status로 분류합니다. 429, 503은 `unavailable`, 그 밖의 비2xx는 `api`입니다.
- JSON이 아닌 본문은 status로 분류하고, schema에 맞지 않는 응답은 `api`입니다.
- Timeout은 `timeout`, 연결 오류와 그 밖의 transport 실패는 `api`입니다.

## 검증

```bash
pnpm --filter @dfragon/neople test
```

`test`는 `@dfragon/lib`과 이 package를 build한 뒤 `test/*.test.mjs`를 `dist` 대상으로 실행합니다.
