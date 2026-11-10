# @dfragon/database

API가 쓰는 PostgreSQL 설정 읽기, Prisma 설정, 시작 때 migration 적용과 migration CLI를 담은 package입니다.
`prisma`, `@prisma/client`, `@prisma/adapter-pg`(모두 7.10.1) 의존성을 이 package가 갖고, API는 `"@dfragon/database": "workspace:*"`로 공개 export만 씁니다.
이 package는 `apps/api`를 import하지 않습니다. 동작은 [API README의 DB와 migration](../../apps/api/README.md#db와-migration)을 따릅니다.

## 공개 export

- `readDatabaseConfiguration(environment)`: DB 입력 다섯 개를 읽어 설정이나 `undefined`를 돌려주고, 일부만 있으면 던집니다.
- `applyMigrations()`: 현재 프로세스의 DB 입력으로 `prisma migrate deploy`를 실행합니다.
- `createDatabaseClient(configuration)`: `@prisma/adapter-pg`를 쓰는 Prisma client(`DatabaseClient`)를 만듭니다. 끝낼 때 호출자가 `$disconnect()`를 부릅니다.
- `recordCharacter(client, character)`: 캐릭터의 서버, id, 이름과 모험단을 기록합니다.
- `recordCharacterBasic(client, basic)`: Neople 기본 정보를 저장하고 기본 정보 대기열 행을 지웁니다.
- `recordCharacterSkillStyle(client, style)`: 캐릭터의 스킬 스타일을 덮어씁니다.
- `readSampleCharactersWithoutSkillStyle(client)`: 전직별 명성 상위 표본 가운데 지금 전직의 스킬 스타일이 저장되지 않은 캐릭터를 읽습니다.
- `enqueueCollectedCharacters`, `takeCollectionBatch`, `recordCollectionFailure`: 기본 정보 대기열에 넣고, 꺼내고, 실패를 남깁니다.
- `readAdventureCharacters`, `readAdventureNames`, `readGuild`: 모험단, 길드의 캐릭터와 캐릭터의 모험단 이름을 읽습니다.
- `readFameRanking`, `readCharacterStats`, `readJobSkillAdoption`: 명성 랭킹, 캐릭터 통계, 전직별 스킬 채택 수를 읽습니다.
- `saveCharacterStats`, `readFamedJobGrows`, `saveJobSkillAdoption`, `deleteJobSkillAdoptionComputedBefore`: 통계 저장분을 덮어쓰고, 명성 있는 캐릭터의 전직 목록을 읽고, 스킬 채택 수 저장분을 덮어쓰거나 지난 행을 지웁니다.
- `readCharacterStatsSnapshot`, `readJobSkillAdoptionSnapshot`: 통계와 전직별 스킬 채택 수 저장분을 읽고, 없으면 `null`을 돌려줍니다.
- `recordContentClears`, `recordContentClearPopulation`, `readClearPopulation`, `CLEAR_POPULATION_SIZE`(100,000): 클리어 집계의 클리어 기록과 주별 모집단을 저장하고, 명성 상위 모집단을 읽습니다.
- `readContentClearCollection`, `startContentClearCollection`, `recordContentClearCollectionProgress`, `finishContentClearCollection`: 클리어 수집의 진행 위치를 읽고 씁니다.
- `readContentClearCollectedAt`, `readContentClearPopulations`, `readContentClearWeekRatioCounts`, `readContentClearJobCounts`, `readContentClearAdventureSizes`: 클리어 집계의 마지막 수집 시각, 주별 모집단, 주와 배율별 클리어 수, 한 주의 직업별 클리어 수와 모험단 크기 분포를 읽습니다.
- `registerJobs`, `startJobRun`, `claimRequestedJobRun`, `finishJobRun`과 나머지 job 함수: 배치 job 목록과 실행 이력을 쓰고 읽습니다.
- `SKILL_STYLE_SAMPLE_TOP_COUNT`(5000), `MALE_CRUSADER_DEALER_SKILL`(`용기의 은총`): 스킬 채택 표본 순위와 남성 크루세이더 딜러 판정 스킬입니다.
- `replaceTimelineRange`, `replaceEnhancementBackfillRange`, `replaceSeasonBackfillRange`: 캐릭터 하나의 타임라인 구간을 한 transaction에서 교체합니다.
- `recordSeasonBackfillCompleted`, `readSeasonBackfillStates`, `readEnhancementBackfilledUntil`: 옛 시즌 받기와 강화 백필 위치를 기록, 조회합니다.
- `readTimelineSyncState`, `recordTimelineSyncSuccess`, `recordTimelineSyncFailure`: 타임라인 동기화 상태를 읽고 기록합니다.
- `readCurrentSeasonStart`, `readSeasons`: 지금 시즌의 시작 시각과 시즌 목록을 읽습니다.
- `readTimelineEvents`, `readCharactersTimelineEvents`, `readCharactersTimelineItems`, `readRecentTimelineItems`: 저장한 타임라인 행을 읽습니다.
- `readSecretInput(value, file)`: 직접 입력과 절대 경로 파일 중 하나에서 secret을 읽습니다.
- 위 함수의 입력, 결과 타입을 함께 export합니다.

## 연결 URL

`src/prisma.config.ts`가 `readDatabaseConfiguration`으로 DB 입력을 읽고 계정, 비밀번호, DB 이름을 URL 인코딩해 `datasource.url`을 만듭니다.
Prisma 7.10.1의 CLI는 연결 URL 전체를 schema engine의 명령 인자로 넘기므로, migration이 도는 몇 초 동안 그 프로세스의 명령 인자에 비밀번호가 보입니다(ADR 0014).

## 빌드와 migration

`build`는 `@dfragon/lib`를 먼저 빌드하고 `prisma generate`로 `src/generated/prisma`에 client를 만든 뒤 `tsc`로 `dist`를 만듭니다. 생성한 client는 커밋하지 않고, DB 설정 없이도 빌드됩니다.
Schema는 `prisma/schema.prisma`, migration은 `prisma/migrations/<이름>/migration.sql`입니다. 새 `migration.sql`은 `BEGIN;`과 `COMMIT;`으로 감쌉니다.
Migration CLI는 API의 `apps/api/.env`에서 DB 설정을 읽습니다.

```sh
pnpm --filter @dfragon/database db:migrate:dev --name add_example
pnpm --filter @dfragon/database db:migrate:status
pnpm --filter @dfragon/database db:migrate:deploy
pnpm --filter @dfragon/database db:migrate:reset
```

`dev`와 `reset`은 로컬 DB에만 씁니다. 운영은 API가 시작할 때 `deploy`와 같은 명령을 실행합니다.
운영 이미지 안에서는 pnpm 없이 `node node_modules/@dfragon/database/dist/cli.js <prisma 명령>`으로 같은 설정의 Prisma 명령을 실행합니다.
실패한 migration은 `migrate status`로 이름을 확인하고 `migrate resolve --rolled-back <migration 이름>`으로 기록을 정리한 뒤 고친 이미지를 다시 배포합니다.

## 테이블

- `adventures`: 자체 id를 붙인 모험단과 지금 이름
- `characters`: 캐릭터와 Neople 기본 정보
- `character_skill_styles`: 캐릭터마다 최신 스킬 스타일 한 행
- `character_collection`: 기본 정보를 받을 캐릭터 대기열
- `seasons`: 게임 시즌 번호, 이름, 시작 시각
- `timeline_events`: 코드 1xx, 2xx, 3xx 타임라인
- `timeline_items`: 코드 4xx, 5xx, 55x, 6xx 타임라인. 시즌별 range partition `timeline_items_season_<시즌 id>`입니다
- `timeline_sync_state`: 캐릭터별 동기화, 강화 백필 위치
- `timeline_season_backfill`: 캐릭터와 시즌별 옛 시즌 받기 위치
- `jobs`: worker가 시작할 때 올린 배치 job 목록
- `job_runs`: 배치 job 실행 한 번이 한 행인 실행 이력
- `character_stats`: worker job이 계산한 최신 캐릭터 통계 한 행
- `job_skill_adoption`: worker job이 계산한 전직, 역할별 최신 스킬 채택 수

## 검증

`pnpm --filter @dfragon/database test`는 package를 빌드한 뒤 `test/*.test.mjs`를 실행합니다.
시작 때 migration과 테이블은 [`container-database.mjs`](../../apps/api/test-support/container-database.mjs)로 확인합니다.

## 고지

이 package는 제3자 코드나 생성 데이터를 담지 않아 `@dfragon/lib`처럼 고지를 복사하지 않습니다.
`prisma`와 그 전이 의존성의 라이선스 원문은 API 이미지의 `node_modules`에 패키지와 함께 들어갑니다.
