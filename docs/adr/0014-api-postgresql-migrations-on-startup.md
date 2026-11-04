---
type: adr
status: accepted
scope: apps/api의 PostgreSQL 설정, migration 적용 시점과 도구
decided: 2026-11-04
last-reviewed: 2026-11-04
superseded-by: 없음
evidence: "Issue #1164(https://github.com/dungeon-and-dragon/dfragon/issues/1164) ; 인프라 Issue dfragon-infra#68(https://github.com/dungeon-and-dragon/dfragon-infra/issues/68) ; 저장소 소유자 결정(2026-11-04)"
review-after: API 컨테이너를 여러 개 띄울 때, 시작 전 migration을 배포 helper가 따로 실행하게 바꿀 때
---

# ADR 0014: API가 시작할 때 PostgreSQL migration을 TypeORM으로 적용한다

## 상태

채택. 2026-10-26의 "API는 DB를 두지 않는다"([Issue #796](https://github.com/dungeon-and-dragon/dfragon/issues/796)) 가운데 DB 부분을 바꾼다. 회원 인증 서비스는 여전히 두지 않는다.

## 맥락

저장소 소유자가 2026-11-04에 API에 PostgreSQL을 다시 붙이기로 했다([dfragon-infra#68](https://github.com/dungeon-and-dragon/dfragon-infra/issues/68)).
운영 node1에는 별도 Compose project의 PostgreSQL 18.6이 있고, API 컨테이너는 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`과 secret 파일 `/run/secrets/db_password`를 받는다.
DB 계정 `dfragon_api`는 `public` schema의 owner라 DDL을 할 수 있지만 database에 `CREATE` 권한이 없어 extension, schema는 만들 수 없다.
배포 helper는 새 컨테이너의 `/health`가 뜨지 않으면 이전 이미지로 되돌린다.
지금은 API 컨테이너가 하나지만 나중에 여러 개 띄울 수 있다.

## 결정

- **도구**: `typeorm`과 `pg`를 쓴다. PostgreSQL을 지우기 전(#798 이전)에 쓰던 조합이고, migration 기록 테이블, transaction, 생성, 되돌리기 CLI를 라이브러리가 제공한다. 업무 테이블을 Nest에 연결할 때 `@nestjs/typeorm`을 더한다.
- **설정**: DB 입력 다섯 개(`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 또는 `DB_PASSWORD_FILE`)는 전부 있거나 전부 없어야 한다. 전부 없으면 DB 없이 지금처럼 뜬다. 일부만 있으면 시작 설정 오류로 끝난다.
- **적용 시점**: DB 설정이 있으면 `listen` 전에 아직 적용하지 않은 migration을 한 transaction으로 적용한다. 배포 helper나 운영자가 따로 migration 명령을 실행하지 않는다.
- **동시 시작**: TypeORM은 migration을 직렬화하지 않으므로 PostgreSQL session advisory lock을 잡은 채로 적용한다. 동시에 시작한 다른 인스턴스는 lock을 기다린 뒤 적용할 것이 없음을 확인하고 뜬다.
- **실패**: 연결, 인증, migration이 실패하면 transaction을 되돌리고 프로세스를 0이 아닌 코드로 끝낸다. `/health`가 뜨지 않으므로 배포 helper가 이전 이미지로 복귀한다. `/health`는 DB를 확인하지 않는 정적 응답으로 둔다.
- **범위**: migration은 `public` schema 안에서만 한다. Extension, schema 생성이 필요하면 DB 쪽 권한을 먼저 바꾼다.
- **첫 PR**: 설정, 시작 때 적용, advisory lock, migration 폴더와 CLI만 둔다. 업무 테이블은 다음 PR에서 더한다.

## 결과

- 이전 이미지로 복귀해도 새 이미지가 적용한 schema는 그대로 남는다. 그래서 migration을 더하는 PR은 이전 이미지가 새 schema로 뜨는지, 되돌릴 수 없는 변경(열, 테이블 삭제, 자료 변환)이 있는지를 PR 위험에 적는다.
- 운영 배포 전의 호환성 검토는 "API는 DB가 없다" 대신 위 두 가지를 본다.
- Lock을 잡은 인스턴스가 멈추면 다른 인스턴스는 시작하지 못하고 기다린다. Migration의 DDL도 다른 연결이 잡은 테이블 lock을 상한 없이 기다린다. 지금은 인스턴스가 하나이고 업무 테이블이 없어 `lock_timeout` 같은 대기 상한을 두지 않는다.
- 모든 migration을 한 transaction으로 적용하므로 transaction 밖에서 돌아야 하는 migration(`CREATE INDEX CONCURRENTLY` 등)은 이 방식으로 쓸 수 없다.
- 시작할 때 DB가 아직 준비되지 않았으면 재시도 없이 끝난다. 다시 띄우는 일은 컨테이너 restart 정책이 맡는다.
