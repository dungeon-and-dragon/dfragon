// 운영 계정은 database CREATE 권한이 없어 extension을 만들 수 없다. 앞의 CREATE TABLE이 되돌려지는지 본다.
export class FailingMigration1700000000000 {
  name = 'FailingMigration1700000000000'

  async up(queryRunner) {
    await queryRunner.query('CREATE TABLE failing_migration_probe (id integer)')
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  }

  async down() {}
}
