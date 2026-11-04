import { PrismaPg } from '@prisma/adapter-pg'
import type { DatabaseConfiguration } from './configuration.js'
import { createDatabaseUrl } from './database-url.js'
import { PrismaClient } from './generated/prisma/client.js'

export type DatabaseClient = PrismaClient

export function createDatabaseClient(configuration: DatabaseConfiguration): DatabaseClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: createDatabaseUrl(configuration) })
  })
}
