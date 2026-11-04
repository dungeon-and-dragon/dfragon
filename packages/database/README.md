# @dfragon/database

API가 쓰는 PostgreSQL 설정 읽기, Prisma 설정, 시작 때 migration 적용과 migration CLI를 담은 package입니다.
`prisma`, `@prisma/client`, `@prisma/adapter-pg`(모두 7.10.1) 의존성을 이 package가 갖고, API는 `"@dfragon/database": "workspace:*"`로 공개 export만 씁니다.
이 package는 `apps/api`를 import하지 않습니다. 동작은 [API README의 DB와 migration](../../apps/api/README.md#db와-migration)을 따릅니다.

## 공개 export

- `readDatabaseConfiguration(environment)`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`과 `DB_PASSWORD` 또는 `DB_PASSWORD_FILE`을 읽습니다.
  모두 없으면 `undefined`, 모두 있으면 설정, 일부만 있으면 `Invalid database configuration`을 던집니다.
- `applyMigrations()`: 현재 프로세스의 DB 입력으로 `prisma migrate deploy`를 child process로 실행하고, 실패하면 오류를 던집니다.
  Prisma CLI의 출력은 버립니다.
- `createDatabaseClient(configuration)`: 같은 연결 URL로 `@prisma/adapter-pg`를 쓰는 Prisma client(`DatabaseClient`)를 만듭니다.
  연결은 첫 query 때 열리고, 끝낼 때는 호출자가 `$disconnect()`를 부릅니다.
- `recordCharacter(client, character)`: 캐릭터의 서버, id, 이름과 모험단 이름(`CharacterInput`)을 기록합니다.
  Neople은 모험단 id를 주지 않아 `adventures`가 자체 id를 붙입니다.
  캐릭터는 모험단을 옮기지 못하므로, 이미 기록한 캐릭터의 모험단 이름이 다르면 그 모험단의 이름이 바뀐 것으로 보고 이름만 바꿉니다.
  처음 보는 캐릭터는 같은 이름의 모험단에 붙이고(같은 이름이 여럿이면 가장 나중에 만든 행), 없으면 모험단을 만듭니다. 모험단 이름 단위 advisory lock으로 같은 모험단이 두 번 생기지 않게 합니다.
- `replaceTimelineRange(client, character, range, events, items)`: 캐릭터 하나의 `[range.start, range.end]`(양 끝 포함) 타임라인을 교체합니다.
  한 transaction 안에서 캐릭터 단위 `pg_advisory_xact_lock`을 잡고, `timeline_events`, `timeline_items`에서 그 구간의 행을 지운 뒤 새 행을 넣고, `timeline_sync_state.synced_until`을 `range.end`로 옮깁니다.
  Transaction timeout은 lock 대기를 포함해 60초입니다. 로컬에서 items 5만 행 교체가 Prisma 기본값 5초를 넘었습니다.
  `range.start`가 중천 시작보다 앞이고 그 앞의 item이 있으면 들어갈 partition이 없어 전체가 실패합니다.
  타임라인 행에는 고유 ID가 없고 같은 분에 같은 내용의 행이 여러 개 있을 수 있어 중복 검사 대신 구간 교체로 맞춥니다. 구간 밖 행이 있으면 아무것도 바꾸지 않고 `RangeError`를 던집니다.
- `readTimelineSyncState(client, character)`: `synced_until`, `last_succeeded_at`을 돌려주고, 행이 없으면 `undefined`입니다.
  첫 구간을 넣기 전에 실패만 기록된 캐릭터는 `syncedUntil`이 `null`입니다.
- `recordTimelineSyncSuccess(client, character)`: `last_attempted_at`, `last_succeeded_at`을 지금으로 두고 `last_failure`를 비웁니다.
- `recordTimelineSyncFailure(client, character, failure)`: `last_attempted_at`과 `last_failure`만 바꿉니다.
- 입력 타입 `TimelineEventInput`, `TimelineItemInput`, `TimelineCharacter`, `TimelineRange`와 결과 타입 `TimelineSyncState`를 함께 export합니다.
- `readSecretInput(value, file)`: 직접 입력과 절대 경로 파일 중 하나에서 secret을 읽습니다. API의 Neople key도 같은 함수로 읽습니다.
  `@dfragon/lib`는 Node 전용 runtime에 의존하지 않아야 해서 `node:fs`를 쓰는 이 함수를 이 package에 둡니다.

## 연결 URL

`src/prisma.config.ts`가 `readDatabaseConfiguration`으로 DB 입력을 읽고 계정, 비밀번호, DB 이름을 URL 인코딩해 `datasource.url`을 만듭니다.
Child process에는 현재 환경변수를 그대로 넘기므로, API가 실행하는 Prisma 명령에는 운영 비밀번호가 `/run/secrets/db_password` 파일 경로로만 전달됩니다.
다만 Prisma 7.10.1의 CLI는 schema engine을 실행할 때 연결 URL 전체를 `--datasource` 명령 인자로 넘기므로, migration이 도는 몇 초 동안 schema engine 프로세스의 명령 인자에 비밀번호가 보입니다.

## 빌드와 migration

`build`는 `@dfragon/lib`를 먼저 빌드하고 `dist`를 지운 뒤 `prisma generate`로 `src/generated/prisma`에 client를 만들고 `tsc`로 다시 만듭니다.
생성한 client는 커밋하지 않습니다. Prisma CLI는 실행 위치의 `prisma.config.ts`를 자동으로 읽는데, 설정이 package 루트가 아닌 `src`에 있어 `generate`가 읽지 않으므로 DB 설정 없이도 빌드됩니다. 설정을 package 루트로 옮기면 DB 설정이 없는 빌드가 실패합니다.
Prisma 설정은 `dist/prisma.config.js`, schema는 `prisma/schema.prisma`, migration은 `prisma/migrations/<이름>/migration.sql`입니다.

## 테이블

| 테이블 | 내용 |
| --- | --- |
| `adventures` | 자체 모험단 id와 지금 이름. 서버가 달라도 한 모험단입니다 |
| `characters` | PK `(server_id, character_id)`, 지금 캐릭터 이름, 모험단 id. Neople 기본 정보를 받아 저장한 캐릭터는 레벨, 직업 id와 이름, 명성, 길드, `basic_fetched_at`도 있고, 다른 경로로 기록한 캐릭터는 이 열이 null입니다 |
| `character_collection` | 기본 정보를 받을 캐릭터 대기열. PK `(server_id, character_id)`, 넣은 시각, 실패한 시도의 시각과 이유. 저장에 성공하면 행을 지웁니다 |
| `seasons` | 시즌 id, 이름, 시작 시각. 중천(`2025-01-09 06:00+09`), 천해천(`2026-03-26 06:00+09`)을 migration이 넣습니다 |
| `timeline_events` | 코드 1xx, 2xx, 3xx 타임라인. partition이 없습니다 |
| `timeline_items` | 코드 4xx, 5xx, 55x, 6xx 타임라인. `occurred_at` 기준 시즌별 range partition이며 PK는 `(id, occurred_at)`입니다 |
| `timeline_sync_state` | 캐릭터별 `synced_until`, 마지막 시도와 성공 시각, 실패 이유 |

`timeline_items`의 partition은 `timeline_items_season_1`(중천 시작부터 천해천 시작 전까지), `timeline_items_season_2`(천해천 시작부터 `MAXVALUE`까지)입니다.
조회는 모험단 이름(`adventures.name`), 캐릭터 이름(`characters(server_id, character_name)`)으로 캐릭터를 찾고, 두 타임라인 테이블의 `(server_id, character_id, code, occurred_at)` index로 읽습니다.
교체 때 캐릭터와 구간으로 지우는 문장도 PostgreSQL 18의 skip scan으로 같은 index를 씁니다.
로컬에서 items 200만 행의 구간 삭제가 0.7ms, events 200만 행에서 모험단 하나의 레이드 클리어 수가 1ms였습니다.

Migration CLI는 API의 `apps/api/.env`에서 DB 설정을 읽습니다.

```sh
pnpm --filter @dfragon/database db:migrate:dev --name add_example
pnpm --filter @dfragon/database db:migrate:status
pnpm --filter @dfragon/database db:migrate:deploy
pnpm --filter @dfragon/database db:migrate:reset
```

`dev`는 schema와 DB의 차이로 새 migration을 만들고 적용하며, shadow database를 만들 권한이 필요해 로컬 DB에만 씁니다.
`reset`은 DB를 지우고 다시 만들므로 로컬 DB에만 씁니다.
운영은 API가 시작할 때 `deploy`와 같은 명령을 실행하므로 따로 실행하지 않습니다.

운영 이미지 안에서는 pnpm 없이 `node node_modules/@dfragon/database/dist/cli.js <prisma 명령>`으로 같은 설정의 Prisma 명령을 실행합니다.
막혔을 때의 절차는 [API README의 migration 실패 복구](../../apps/api/README.md#migration-실패-복구)에 있습니다.

## Migration 작성 규칙

Prisma는 실패한 migration을 되돌리지 않고 실패로 기록하며, 기록을 고치기 전까지 다음 `migrate deploy`는 `P3009`로 실패합니다.
그래서 새 `migration.sql`은 `BEGIN;`과 `COMMIT;`으로 감싸 실패해도 중간 상태가 남지 않게 합니다. `migrate dev`가 만든 파일도 감싼 뒤 커밋합니다.
`CREATE INDEX CONCURRENTLY`처럼 transaction 안에서 실행할 수 없는 문장은 그 문장만 담은 별도 migration으로 두고, 실패하면 중간 상태가 남을 수 있다는 것을 PR 위험에 적습니다.

Prisma schema는 partition을 표현하지 못하므로 partition은 손으로 쓴 SQL로만 관리합니다.
Prisma 7.10.1은 partition 자식 테이블을 schema 비교에서 빼고 부모 테이블만 일반 테이블로 비교하므로, partition을 만들거나 붙이고 떼는 문장은 `migrate dev`가 drift로 보지 않습니다.
그래서 `prisma.config.ts`의 external tables 설정은 쓰지 않습니다.
- `timeline_items`에 열이나 index를 더하는 변경은 schema를 고친 뒤 `migrate dev --create-only`가 만든 `ALTER TABLE "timeline_items"`, `CREATE INDEX ... ON "timeline_items"`를 그대로 씁니다. 부모에 건 문장은 PostgreSQL이 partition에도 적용합니다.
- Prisma가 `timeline_items`를 지우고 다시 만드는 SQL(`DROP TABLE`, PK 변경 등)을 만들면 그대로 쓰지 않습니다. 그 SQL은 `PARTITION BY`가 없는 일반 테이블을 만듭니다. 손으로 partition을 유지하는 SQL로 바꿉니다.
- `id` 열은 Prisma가 만드는 `BIGSERIAL` 대신 `BIGINT GENERATED ALWAYS AS IDENTITY`로 씁니다. Prisma는 둘 다 `autoincrement()`로 읽어 차이로 보지 않습니다.
- Migration을 더한 뒤에는 `db:migrate:dev`를 한 번 더 실행해 `Already in sync`가 나오는지 확인합니다.

## 다음 시즌 더하기

새 시즌이 시작하기 전에 migration 하나로 `timeline_items`의 partition을 나누고 `seasons`에 행을 넣습니다.
시작 전이라 지금 시즌 partition에 새 시즌 구간의 행이 없어 옮길 행이 없습니다.
아래는 시즌 3이 `2027-03-25 06:00+09`에 시작한다고 가정한 예입니다.

```sql
BEGIN;

ALTER TABLE "timeline_items" DETACH PARTITION "timeline_items_season_2";
ALTER TABLE "timeline_items" ATTACH PARTITION "timeline_items_season_2"
    FOR VALUES FROM ('2026-03-26 06:00:00+09') TO ('2027-03-25 06:00:00+09');
CREATE TABLE "timeline_items_season_3" PARTITION OF "timeline_items"
    FOR VALUES FROM ('2027-03-25 06:00:00+09') TO (MAXVALUE);

INSERT INTO "seasons" ("id", "name", "starts_at") VALUES (3, '시즌 이름', '2027-03-25 06:00:00+09');

COMMIT;
```

`ATTACH PARTITION`은 붙이는 partition의 행이 새 범위 안에 있는지 검사하므로, 새 시즌 시작 뒤의 행이 이미 있으면 실패하고 transaction 전체가 되돌려집니다.
Prisma가 이 migration을 실패로 기록해 다음 `migrate deploy`가 `P3009`로 막히므로, 뒤에 migration을 더해서는 풀리지 않습니다.
실패한 migration을 아래 순서로 고치고 `migrate resolve --rolled-back <migration 이름>`으로 기록을 정리한 뒤 다시 배포합니다.

1. 지금 시즌 partition을 `DETACH`하고 새 시즌 partition을 `MAXVALUE`까지 만듭니다.
2. `INSERT INTO "timeline_items" OVERRIDING SYSTEM VALUE SELECT * FROM "timeline_items_season_2" WHERE "occurred_at" >= <새 시즌 시작>`으로 시작 뒤 행을 옮깁니다. `id`가 identity라 `OVERRIDING SYSTEM VALUE`가 있어야 그대로 옮겨집니다.
3. 같은 조건으로 `timeline_items_season_2`에서 지운 뒤 상한을 새 시즌 시작으로 정해 `ATTACH`하고 `seasons`에 행을 넣습니다.

정리 명령은 [API README의 migration 실패 복구](../../apps/api/README.md#migration-실패-복구)를 따릅니다.

`DETACH`부터 `COMMIT`까지 `timeline_items` 전체에 ACCESS EXCLUSIVE lock이 걸리고, `ATTACH`는 지금 시즌 partition의 행을 모두 읽어 범위를 확인합니다.
그동안 타임라인 저장과 조회가 기다리고 Prisma migrate lock도 잡혀 있어, 함께 시작한 다른 API 인스턴스는 lock을 10초 안에 얻지 못하면 끝납니다. 인스턴스 하나로 배포할 때 적용합니다.
Schema 모델은 바뀌지 않아 `schema.prisma`는 고치지 않습니다.

## 고지

이 package는 제3자 코드나 생성 데이터를 담지 않아 `@dfragon/lib`처럼 고지를 복사하지 않습니다.
`prisma`와 그 전이 의존성의 라이선스 원문은 API 이미지의 `node_modules`에 패키지와 함께 들어갑니다.

## 검증

`test`는 연결 URL의 인코딩을 확인합니다. 설정 규칙은 API의 `runtime-configuration.test.ts`가, 시작 때 migration과 테이블, partition, 시즌 행, 구간 교체는 [`container-database.mjs`](../../apps/api/test-support/container-database.mjs)가 확인합니다.
구간 교체는 같은 내용의 행 두 개를 두 개로 저장하고 같은 구간을 다시 교체해도 행이 늘지 않는지 봅니다.
