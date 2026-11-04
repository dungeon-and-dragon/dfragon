---
type: adr
status: accepted
scope: apps/api의 PostgreSQL 설정, migration 적용 시점과 도구, packages/database
decided: 2026-11-04
last-reviewed: 2026-11-04
superseded-by: 없음
evidence: "Issue #1164(https://github.com/dungeon-and-dragon/dfragon/issues/1164) ; 인프라 Issue dfragon-infra#68(https://github.com/dungeon-and-dragon/dfragon-infra/issues/68) ; 저장소 소유자 결정(2026-11-04, ORM은 Prisma, DB 코드는 별도 package)"
review-after: API 컨테이너를 여러 개 띄울 때, Prisma ORM 8로 올릴 때
---

# ADR 0014: API가 시작할 때 PostgreSQL migration을 Prisma로 적용한다

## 상태

채택. 2026-10-26의 "API는 DB를 두지 않는다"([Issue #796](https://github.com/dungeon-and-dragon/dfragon/issues/796)) 가운데 DB 부분을 바꾼다. 회원 인증 서비스는 여전히 두지 않는다.

## 맥락

저장소 소유자가 2026-11-04에 API에 PostgreSQL을 다시 붙이기로 했다([dfragon-infra#68](https://github.com/dungeon-and-dragon/dfragon-infra/issues/68)).
운영 node1에는 별도 Compose project의 PostgreSQL 18.6이 있고, API 컨테이너는 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`과 secret 파일 `/run/secrets/db_password`를 받는다.
DB 계정 `dfragon_api`는 `public` schema의 owner라 DDL을 할 수 있지만 database에 `CREATE` 권한이 없어 extension, schema는 만들 수 없다.
API 컨테이너는 read-only root에 쓰기 가능한 곳이 `/tmp` tmpfs 16MB뿐이고 `cap_drop: ALL`, UID 1000으로 돈다.
배포 helper는 새 컨테이너의 `/health`가 뜨지 않으면 이전 이미지로 되돌린다.

## 결정

- **도구**: Prisma ORM 7(7.10.1)을 쓴다. 소유자가 고른 도구이며, 모델과 datasource를 `schema.prisma` 파일 하나에 두고 업무 모델을 더하면 타입이 생성된다. 8은 아직 release candidate라 7의 최신 안정판을 쓴다.
- **위치**: DB 설정 읽기, Prisma 설정, migration 적용, migration 폴더와 CLI는 workspace package `packages/database`(`@dfragon/database`)에 둔다. `prisma`는 이 package가 갖고, API는 공개 export만 쓰며 package는 API를 import하지 않는다.
- **설정**: DB 입력 다섯 개(`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 또는 `DB_PASSWORD_FILE`)는 전부 있거나 전부 없어야 한다. 전부 없으면 DB 없이 지금처럼 뜬다. 일부만 있으면 시작 설정 오류로 끝난다.
- **연결 URL**: `prisma.config.ts`가 같은 설정 함수로 DB 입력을 읽어 URL을 만들고, 계정과 비밀번호, DB 이름은 URL 인코딩한다. API가 실행하는 Prisma 명령의 인자와 새 환경변수에는 비밀번호를 넣지 않는다. 다만 Prisma 7.10.1의 CLI는 schema engine을 실행할 때 연결 URL 전체를 `--datasource` 명령 인자로 넘기므로, migration이 도는 몇 초 동안 schema engine 프로세스의 명령 인자에 비밀번호가 보인다. URL에서 비밀번호를 빼고 `PGPASSWORD`로 넘기는 방법은 schema engine이 지원하지 않는다. 소유자가 이 노출을 받아들이기로 했다(2026-11-04).
- **적용 시점**: DB 설정이 있으면 API가 `listen` 전에 `prisma migrate deploy`를 child process로 실행한다. entrypoint에서 실행하면 셸에서 설정 검증, 비밀번호 파일 읽기, URL 인코딩을 다시 만들어야 해서 앱 코드에서 실행한다.
- **동시 시작**: `prisma migrate deploy`가 PostgreSQL advisory lock(key `72707369`)을 스스로 잡으므로 직접 lock을 걸지 않는다. Lock은 10초 안에 얻지 못하면 실패한다.
- **실패**: 연결, 인증, migration이 실패하면 프로세스를 0이 아닌 코드로 끝낸다. `/health`가 뜨지 않으므로 배포 helper가 이전 이미지로 복귀한다. `/health`는 DB를 확인하지 않는 정적 응답으로 둔다. 시작 출력은 `API failed to start` 한 줄로 두고 Prisma CLI의 출력은 버린다.
- **Transaction**: Prisma는 실패한 migration을 되돌리지 않으므로 `migration.sql`은 `BEGIN;`과 `COMMIT;`으로 감싼다. Transaction 안에서 실행할 수 없는 문장(`CREATE INDEX CONCURRENTLY` 등)은 별도 migration으로 두고 PR 위험에 적는다.
- **범위**: migration은 `public` schema 안에서만 한다. Extension, schema 생성이 필요하면 DB 쪽 권한을 먼저 바꾼다.
- **첫 PR**: `schema.prisma`에는 datasource와 generator만 두고, 설정, 시작 때 적용, migration 폴더와 CLI만 둔다. 업무 모델, `@prisma/client`, driver adapter(`@prisma/adapter-pg`)는 다음 PR에서 더한다.

## 결과

- 이전 이미지로 복귀해도 새 이미지가 적용한 schema는 그대로 남는다. 그래서 migration을 더하는 PR은 이전 이미지가 새 schema로 뜨는지, 되돌릴 수 없는 변경(열, 테이블 삭제, 자료 변환)이 있는지를 PR 위험에 적는다.
- 운영 배포 전의 호환성 검토는 "API는 DB가 없다" 대신 위 두 가지를 본다.
- Migration이 실패하면 `_prisma_migrations`에 실패로 기록되고, `prisma migrate resolve`로 정리하기 전까지 다음 `migrate deploy`는 `P3009`로 실패한다. `BEGIN`, `COMMIT`으로 감싼 migration은 앞 문장도 되돌려지므로 관리자는 원인을 고친 뒤 기록만 정리하면 된다. 감싸지 않은 migration은 실패 전까지 실행된 문장이 남아 DB도 직접 정리해야 한다.
- 동시에 시작한 인스턴스 가운데 하나가 10초 넘게 migration을 하면 나머지는 lock을 얻지 못하고 끝난다. 지금은 인스턴스가 하나라 문제가 되지 않는다.
- Prisma schema engine은 Rust 바이너리로, 이미지 빌드 때 OpenSSL 3용(`debian-openssl-3.0.x`)이 설치된다. 런타임 이미지에 `libssl3`을 더했고 실행 중에는 엔진을 받거나 파일을 쓰지 않는다.
- Migration이 도는 동안 node1 host에서 프로세스 목록을 볼 수 있는 다른 계정은 비밀번호를 볼 수 있다. DB는 `dfragon_backend` internal network에서만 접속할 수 있어 영향은 작다. 완화 후보는 node1의 `/proc` `hidepid=2`이며 관리자 작업이다.
- Prisma CLI와 그 의존성 때문에 API 이미지가 커진다.
- 시작할 때 DB가 아직 준비되지 않았으면 재시도 없이 끝난다. 다시 띄우는 일은 컨테이너 restart 정책이 맡는다.
