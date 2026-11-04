-- 운영 계정은 database CREATE 권한이 없어 extension을 만들 수 없다. 두 번째 문장에서 실패한다.
BEGIN;
CREATE TABLE failing_migration_probe (id integer);
CREATE EXTENSION IF NOT EXISTS pgcrypto;
COMMIT;
