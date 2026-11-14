import assert from 'node:assert/strict'
import test from 'node:test'
import { readRuntimeConfiguration } from '../src/runtime/configuration.js'

// 합성 비밀번호이며 실제 credential이 아니다.
const databaseEnvironment = {
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_NAME: 'dfragon',
  DB_USERNAME: 'dfragon_api',
  DB_PASSWORD: 'synthetic-db-password'
}

test('운영 app 설정은 PORT와 DB 입력을 읽고, Neople key 없이 시작한다', () => {
  const configuration = readRuntimeConfiguration({ PORT: '3444', ...databaseEnvironment })

  assert.equal(configuration.port, 3444)
  assert.deepEqual(
    [configuration.database.host, configuration.database.port, configuration.database.database],
    ['postgres', 5432, 'dfragon']
  )
})

test('운영 app 설정은 DB 입력이 없거나 PORT가 잘못되면 값 없이 실패한다', () => {
  for (const environment of [
    { PORT: '3444' },
    { PORT: '3444', DB_HOST: 'postgres' },
    { ...databaseEnvironment },
    { PORT: '0', ...databaseEnvironment }
  ]) {
    assert.throws(
      () => readRuntimeConfiguration(environment),
      new Error('Invalid ops runtime configuration'),
      JSON.stringify(Object.keys(environment))
    )
  }
})
