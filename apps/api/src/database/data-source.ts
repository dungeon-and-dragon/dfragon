import { fileURLToPath } from 'node:url'
import type { DataSourceOptions } from 'typeorm'
import type { DatabaseConfiguration } from './configuration.js'

export function createDataSourceOptions(configuration: DatabaseConfiguration): DataSourceOptions {
  return {
    type: 'postgres',
    ...configuration,
    connectTimeoutMS: 2000,
    synchronize: false,
    migrationsRun: false,
    logging: false,
    migrationsTransactionMode: 'all',
    migrationsTableName: 'typeorm_migrations',
    entities: [],
    migrations: [fileURLToPath(new URL('./migrations/*.js', import.meta.url))]
  }
}
