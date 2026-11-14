import { PrismaPg } from '@prisma/adapter-pg'
import type { DatabaseConfiguration } from './configuration.js'
import { createDatabaseUrl } from './database-url.js'
import { PrismaClient } from './generated/prisma/client.js'

export type DatabaseClient = PrismaClient

export type DatabasePoolOptions = {
  maxConnections?: number
  connectionTimeoutMs?: number
  statementTimeoutMs?: number
}

// 값을 주지 않은 항목은 pg 기본값(연결 10개, 연결 대기와 쿼리 시간 상한 없음)이다.
export function createDatabaseClient(
  configuration: DatabaseConfiguration,
  { maxConnections, connectionTimeoutMs, statementTimeoutMs }: DatabasePoolOptions = {}
): DatabaseClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: createDatabaseUrl(configuration),
      max: maxConnections,
      connectionTimeoutMillis: connectionTimeoutMs,
      statement_timeout: statementTimeoutMs
    })
  })
}
