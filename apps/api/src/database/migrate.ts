import { DataSource, MigrationExecutor } from 'typeorm'
import type { Logger } from 'typeorm'
import type { DatabaseConfiguration } from './configuration.js'
import { createDataSourceOptions } from './data-source.js'

// TypeORM은 logging: false여도 migration 진행과 PostgreSQL 오류를 콘솔에 쓴다.
// 시작 출력은 stdout의 JSON 접근 로그와 실패 문구 한 줄로 유지한다.
const silentLogger: Logger = {
  logQuery: () => {},
  logQueryError: () => {},
  logQuerySlow: () => {},
  logSchemaBuild: () => {},
  logMigration: () => {},
  log: () => {}
}

const MIGRATION_LOCK = "hashtext('dfragon-api-migrations')"

export async function applyMigrations(configuration: DatabaseConfiguration): Promise<void> {
  const dataSource = new DataSource({
    ...createDataSourceOptions(configuration),
    logger: silentLogger
  })
  try {
    await dataSource.initialize()
  } catch (error) {
    // TypeORM은 pool을 만든 뒤 첫 조회(server version 등)가 실패하면 pool을 닫지 않는다.
    // 열린 연결이 프로세스 종료를 막지 않게 닫는다. pool이 없으면 disconnect가 실패하므로 무시한다.
    await dataSource.driver.disconnect().catch(() => {})
    throw error
  }
  try {
    // TypeORM은 migration을 직렬화하지 않는다. 여러 인스턴스가 동시에 시작해도 기록 테이블 생성과
    // migration이 한 번만 돌도록 session advisory lock을 잡는다. 같은 연결에서 실행해야
    // lock을 잡은 연결이 끊겼을 때 migration도 함께 실패한다.
    const queryRunner = dataSource.createQueryRunner()
    try {
      await queryRunner.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK})`)
      try {
        const executor = new MigrationExecutor(dataSource, queryRunner)
        executor.transaction = 'all'
        await executor.executePendingMigrations()
      } finally {
        await queryRunner.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK})`)
      }
    } finally {
      await queryRunner.release()
    }
  } finally {
    // 연결을 닫으면 unlock이 실패한 경우에도 session lock이 풀린다.
    await dataSource.destroy()
  }
}
