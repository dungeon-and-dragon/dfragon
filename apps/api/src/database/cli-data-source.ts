import { DataSource } from 'typeorm'
import { readDatabaseConfiguration } from './configuration.js'
import { createDataSourceOptions } from './data-source.js'

const configuration = readDatabaseConfiguration(process.env)
if (configuration === undefined) {
  throw new Error('Invalid database configuration')
}

export default new DataSource(createDataSourceOptions(configuration))
