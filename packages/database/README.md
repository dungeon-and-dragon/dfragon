# @dfragon/database

API가 쓰는 PostgreSQL 설정 읽기, Prisma 설정, 시작 때 migration 적용과 migration CLI를 담은 package입니다.
`prisma`(7.10.1) 의존성을 이 package가 갖고, API는 `"@dfragon/database": "workspace:*"`로 공개 export만 씁니다.
이 package는 `apps/api`를 import하지 않습니다. 동작과 결정은 [API README의 DB와 migration](../../apps/api/README.md#db와-migration)과 [ADR 0014](../../docs/adr/0014-api-postgresql-migrations-on-startup.md)를 따릅니다.

## 공개 export

- `readDatabaseConfiguration(environment)`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`과 `DB_PASSWORD` 또는 `DB_PASSWORD_FILE`을 읽습니다.
  모두 없으면 `undefined`, 모두 있으면 설정, 일부만 있으면 `Invalid database configuration`을 던집니다.
- `applyMigrations()`: 현재 프로세스의 DB 입력으로 `prisma migrate deploy`를 child process로 실행하고, 실패하면 오류를 던집니다.
  Prisma CLI의 출력은 버립니다.
- `readSecretInput(value, file)`: 직접 입력과 절대 경로 파일 중 하나에서 secret을 읽습니다. API의 Neople key도 같은 함수로 읽습니다.
  `@dfragon/lib`는 Node 전용 runtime에 의존하지 않아야 해서 `node:fs`를 쓰는 이 함수를 이 package에 둡니다.

## 연결 URL

`src/prisma.config.ts`가 `readDatabaseConfiguration`으로 DB 입력을 읽고 계정, 비밀번호, DB 이름을 URL 인코딩해 `datasource.url`을 만듭니다.
Child process에는 현재 환경변수를 그대로 넘기므로, API가 실행하는 Prisma 명령에는 운영 비밀번호가 `/run/secrets/db_password` 파일 경로로만 전달됩니다.
다만 Prisma 7.10.1의 CLI는 schema engine을 실행할 때 연결 URL 전체를 `--datasource` 명령 인자로 넘기므로, migration이 도는 몇 초 동안 schema engine 프로세스의 명령 인자에 비밀번호가 보입니다.
이 노출과 받아들인 이유는 [ADR 0014](../../docs/adr/0014-api-postgresql-migrations-on-startup.md)에 있습니다.

## 빌드와 migration

`build`는 `@dfragon/lib`를 먼저 빌드하고 `dist`를 지운 뒤 `tsc`로 다시 만듭니다.
Prisma 설정은 `dist/prisma.config.js`, schema는 `prisma/schema.prisma`, migration은 `prisma/migrations/<이름>/migration.sql`입니다.
지금 schema에는 datasource와 generator만 있고, 업무 모델과 `@prisma/client`, driver adapter(`@prisma/adapter-pg`)는 첫 업무 테이블 PR에서 더합니다.

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

## 고지

이 package는 제3자 코드나 생성 데이터를 담지 않아 `@dfragon/lib`처럼 고지를 복사하지 않습니다.
`prisma`와 그 전이 의존성의 라이선스 원문은 API 이미지의 `node_modules`에 패키지와 함께 들어갑니다.

## 검증

`test`는 연결 URL의 인코딩을 확인합니다. 설정 규칙은 API의 `runtime-configuration.test.ts`가, 시작 때 migration은 [`container-database.mjs`](../../apps/api/test-support/container-database.mjs)가 확인합니다.
