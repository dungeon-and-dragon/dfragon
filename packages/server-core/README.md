# @dfragon/server-core

API와 캐릭터 수집 worker가 함께 쓰는 캐릭터 상세, 공용 아이템, 점수, 타임라인, 클리어 통계 코드입니다.
API는 `"@dfragon/server-core": "workspace:*"`로 파일 단위 export를 씁니다.
이 package는 `apps/` 아래 앱, `@dfragon/http-server`, `hono`를 import하지 않습니다.

## 코드 위치

`src/`는 API와 같은 계층 폴더 `domain/`, `application/`, `infrastructure/`로 나누고, `src/` 바로 아래에는 다른 파일을 두지 않습니다.
계층 사이의 import 방향, 계층 밖 파일, domain과 application의 `@dfragon/database`, `@dfragon/neople` 값 import는 `pnpm lint`가 막습니다.

앱은 `src/` 안의 경로에 `.js`를 붙여 import합니다.

```ts
import type { ScoreEngineInput } from '@dfragon/server-core/domain/score/input.js'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/service.js'
import { createScoreEngine } from '@dfragon/server-core/infrastructure/score/engine.js'
```

앱의 domain과 application은 `@dfragon/server-core/infrastructure/`를 import하지 못합니다.

## 테스트 fixture

점수 fixture helper(`test/score-fixtures.ts`)와 `test/fixtures/`는 이 package에 한 벌만 둡니다.
앱의 테스트는 `build:test`로 만든 helper를 `@dfragon/server-core/test/score-fixtures.js`로 import합니다.
`packages/models/score-engine/`에 엔진 라이브러리가 없으면 실제 엔진 계산과 점수 worker를 띄운 종료 확인만 건너뜁니다.

## 검증

```bash
pnpm --filter @dfragon/server-core test
pnpm --filter @dfragon/server-core lint
```

`test`는 `@dfragon/lib`, `@dfragon/database`, `@dfragon/neople`과 이 package를 build한 뒤 `test/*.test.ts`를 compile해 실행합니다.
