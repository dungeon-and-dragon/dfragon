# DFragon worker

`apps/worker`는 캐릭터 수집 worker입니다. 캐릭터 목록 파일에 있는 캐릭터의 기본 정보를 DB에 쌓고, 배치 job도 돌립니다.
지금은 API 이미지에 함께 들어가며, API의 진입 파일 `dist/character-collector.js`가 이 workspace의 시작 함수를 불러 실행합니다.

## 코드 위치

`src/`는 API와 같은 계층 폴더로 나눕니다(ADR 0047, ADR 0057). HTTP 경로가 없어 `presentation/`은 두지 않습니다.
`src/` 바로 아래에는 진입 파일 `main.ts`와 네 계층 폴더(`domain/`, `application/`, `infrastructure/`, `runtime/`)만 둡니다.
계층 사이의 import 방향과 계층 밖 파일, `apps/api` import는 `pnpm lint`가 막습니다.
API와 함께 쓰는 코드는 [`@dfragon/server-core`](../../packages/server-core/README.md)에 있습니다.

Job 정의와 실행 흐름은 `src/application/jobs/`, 예약은 `src/infrastructure/jobs/`, 실행 이력 DB adapter는 `src/infrastructure/database/`에 있고, worker가 돌릴 job은 `src/runtime/worker-jobs.ts`에 등록합니다.
worker가 돌리는 기능은 HTTP 경로가 없어 Controller와 DTO 없이 Service와 Repository만 두고, job 정의(`defineJob`)의 `run`이 Service를 부릅니다.
worker 기능의 Service는 `service.ts`가 아니라 기존 use case 파일(예: `application/content-clears/collection.ts`, `application/character-score/calculation-job.ts`)에 둡니다.
캐릭터 목록 수집 Service, Repository interface와 port는 `src/application/character-collection/`, Neople과 DB adapter는 `src/infrastructure/neople/character-collection.ts`, `src/infrastructure/database/character-collection.ts`, 파일 읽기는 `src/infrastructure/files/character-collection.ts`에 있습니다.
Worker 설정과 연결은 `src/runtime/collector-configuration.ts`, `src/runtime/character-collector.ts`에 있고, 시작 함수 `runCharacterCollector`는 `src/runtime/run-character-collector.ts`에 있습니다.
Worker가 batch Neople key마다 요청을 나눠 보내는 코드는 `src/infrastructure/neople/batch-key-pool.ts`에 있습니다.

## 입력

| 입력 | 필수 | 내용 |
| --- | --- | --- |
| `CHARACTER_IMPORT_FILES` | 필수 | 캐릭터 목록 파일의 절대 경로. 여러 개면 쉼표로 잇습니다 |
| `CHARACTER_COLLECTOR_REQUESTS_PER_SECOND` | 선택 | batch Neople key 하나의 초당 요청 수. 없으면 5입니다 |
| `CHARACTER_COLLECTOR_CONCURRENCY` | 선택 | batch Neople key 하나의 동시 요청 수(1~1024). 없으면 1입니다 |
| `SCORE_LIBRARY_FILE` | 선택 | 점수 엔진 라이브러리(macOS `libdnfscore.dylib`, Linux `libdnfscore.so`)의 절대 경로. 없으면 점수 계산 job만 실패로 끝냅니다 |
| `SCORE_CALCULATION_SCHEDULE` | 선택 | 점수 계산 job 일정(Asia/Seoul cron 식). 없으면 수요일 22:00입니다 |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 또는 `DB_PASSWORD_FILE` | 필수 | [API의 DB 입력](../api/README.md#db와-migration)과 같습니다 |

## 검증

```bash
pnpm --filter @dfragon/worker test
pnpm --filter @dfragon/worker lint
```

`test`는 의존 package와 이 workspace를 build한 뒤 `test/*.test.ts`를 compile해 실행합니다.
