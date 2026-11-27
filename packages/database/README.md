# @dfragon/database

API, worker, 운영 app(`apps/ops`)과 `@dfragon/server-core`가 쓰는 PostgreSQL 설정 읽기, Prisma 설정, 시작 때 migration 적용과 migration CLI를 담은 package입니다.
`prisma`, `@prisma/client`, `@prisma/adapter-pg`(모두 7.10.1) 의존성을 이 package가 갖고, 소비 workspace는 `"@dfragon/database": "workspace:*"`로 공개 export만 씁니다.
이 package는 `apps/api`를 import하지 않습니다. 동작은 [API README의 DB와 migration](../../apps/api/README.md#db와-migration)을 따릅니다.

## 공개 export

공개 export와 입력, 결과 타입의 원본은 `src/index.ts`입니다. `createDatabaseClient`로 만든 client는 끝낼 때 호출자가 `$disconnect()`를 부릅니다.

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

## 검증

`pnpm --filter @dfragon/database test`는 package를 빌드한 뒤 `test/*.test.mjs`를 실행합니다.
시작 때 migration과 테이블은 [`container-database.mjs`](../../apps/api/test-support/container-database.mjs)로 확인합니다.

## 고지

이 package는 제3자 코드나 생성 데이터를 담지 않아 `@dfragon/lib`처럼 고지를 복사하지 않습니다.
`prisma`와 그 전이 의존성의 라이선스 원문은 API, worker, 운영 app 이미지의 `node_modules`에 패키지와 함께 들어갑니다.
