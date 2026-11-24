# DFragon worker

`apps/worker`는 캐릭터 수집 worker입니다. 캐릭터 목록 파일에 있는 캐릭터의 기본 정보를 DB에 쌓고, 배치 job도 돌립니다.
자기 이미지(`apps/worker/Dockerfile`)로 빌드하며, 진입 파일은 `dist/main.js`입니다.

## 코드 위치

`src/`는 API와 같은 계층 폴더로 나눕니다(ADR 0047, ADR 0057). HTTP 경로가 없어 `presentation/`은 두지 않습니다.
`src/` 바로 아래에는 진입 파일 `main.ts`와 네 계층 폴더(`domain/`, `application/`, `infrastructure/`, `runtime/`)만 둡니다.
계층 사이의 import 방향과 계층 밖 파일, `apps/api` import는 `pnpm lint`가 막습니다.
API와 함께 쓰는 코드는 [`@dfragon/server-core`](../../packages/server-core/README.md)에 있습니다.

기능 폴더(`domain/<기능>/`, `application/<기능>/`, `infrastructure/<기술>/`)에는 `index.ts`를 둡니다(ADR 0070).
`index.ts`는 폴더 밖에서 쓰는 이름만 `export { 이름 } from './파일.js'`로 다시 내보냅니다.
폴더 밖에서는 `'#application/<기능>/index.js'`처럼 `index.js`만 import하고, 같은 폴더 안의 파일끼리는 직접 import합니다.
`application/<기능>/repository.ts`, `ports.ts`는 `index.ts`가 다시 내보내지 않고, infrastructure와 runtime이 파일을 직접 import합니다.
계층 폴더 바로 아래의 파일과 `src/runtime/`은 파일을 직접 import합니다.
자기 폴더 밖의 파일은 `#domain/*`, `#application/*`, `#infrastructure/*`, `#runtime/*` alias로 가져오고 `.js` 확장자를 적습니다.
같은 폴더의 파일만 `./파일.js`로 가져옵니다.

Job 정의와 실행 흐름은 `src/application/jobs/`, 예약은 `src/infrastructure/jobs/`, 실행 이력 DB adapter는 `src/infrastructure/database/`에 있고, worker가 돌릴 job은 `src/runtime/worker-jobs.ts`에 등록합니다.
worker가 돌리는 기능은 HTTP 경로가 없어 Controller와 DTO 없이 Service와 Repository만 두고, job 정의(`defineJob`)의 `run`이 Service를 부릅니다.
worker 기능의 Service는 `service.ts`가 아니라 기존 use case 파일(예: `application/content-clears/collection.ts`, `application/character-score/calculation-job.ts`)에 둡니다.
캐릭터 목록 수집 Service, Repository interface와 port는 `src/application/character-collection/`, Neople과 DB adapter는 `src/infrastructure/neople/character-collection.ts`, `src/infrastructure/database/character-collection.ts`, 파일 읽기는 `src/infrastructure/files/character-collection.ts`에 있습니다.
Neople 명성 검색으로 새 캐릭터를 찾아 같은 대기열에 넣는 job은 `src/application/character-collection/discovery.ts`, 명성 구간을 내려가는 규칙은 `src/domain/character-collection/fame-sweep.ts`, Neople adapter는 `src/infrastructure/neople/character-discovery.ts`에 있습니다.
명성 갱신 job과 월말 비활성 캐릭터 재확인 job은 `src/application/character-activity/activity-jobs.ts`, 비활성 판정 기준은 `src/domain/character-activity/activity.ts`, 최근 활동을 읽는 Neople adapter는 `src/infrastructure/neople/character-activity.ts`에 있습니다.
Worker 설정과 연결은 `src/runtime/collector-configuration.ts`, `src/runtime/character-collector.ts`에 있고, 시작 함수 `runCharacterCollector`는 `src/runtime/run-character-collector.ts`에 있습니다.
Worker가 batch Neople key마다 요청을 나눠 보내는 코드는 `src/infrastructure/neople/batch-key-pool.ts`, worker 전체와 key별 요청 속도 제한, 타임라인 동기화 요청을 먼저 내보내는 우선순위는 `src/infrastructure/neople/request-priority.ts`에 있습니다.
요청 테이블의 타임라인 동기화 요청을 집어 처리하는 Service는 `src/application/timeline-sync/`, DB adapter는 `src/infrastructure/database/timeline-sync-request.ts`, 연결은 `src/runtime/timeline-sync.ts`에 있습니다.

## 입력

| 입력 | 필수 | 내용 |
| --- | --- | --- |
| `CHARACTER_IMPORT_FILES` | 필수 | 캐릭터 목록 파일의 절대 경로. 여러 개면 쉼표로 잇습니다 |
| `CHARACTER_COLLECTOR_REQUESTS_PER_SECOND` | 선택 | worker 전체의 초당 Neople 요청 수. key 하나는 이 값과 500 가운데 작은 값을 넘지 않습니다. 없으면 5입니다 |
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

## 서버 이미지

worker 이미지는 운영자가 고른 main commit을 인프라의 빌드 노드가 빌드해 배포합니다.
빌드, 배포 절차는 [인프라 fleet 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/fleet/README.md#배포)를 따릅니다.

로컬 빌드는 API 이미지처럼 [엔진 라이브러리](../../packages/models/README.md)를 `packages/models/score-engine/libdnfscore.so`에 둔 뒤 실행합니다. 엔진 파일이 없으면 빌드에 실패합니다.

```sh
podman build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/worker/Dockerfile -t dfragon-worker:local .
```

이미지는 UID/GID `1000:1000`으로 실행하며 migration을 적용하지 않습니다.
`SCORE_LIBRARY_FILE`은 이미지 안의 엔진 라이브러리를 가리킵니다.
`DB_HOST`를 지정하고 비밀번호 입력을 둘 다 생략하면 `/run/secrets/db_password`를 읽습니다.
실제 PostgreSQL을 붙인 검사는 [API 컨테이너 검사](../api/README.md#컨테이너-검사)가 API 이미지와 함께 실행합니다.
