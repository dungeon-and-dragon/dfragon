import assert from 'node:assert/strict'
import test from 'node:test'
import { createDatabaseUrl } from '../dist/database-url.js'

// 합성 값이며 실제 credential이 아니다.
test('연결 URL은 비밀번호와 계정, DB 이름의 URL 예약 문자를 인코딩한다', () => {
  const url = createDatabaseUrl({
    host: 'postgres',
    port: 5432,
    database: 'dfr/agon?',
    username: 'api@user:1',
    password: 'p@ss/w:rd#?%'
  })

  const parsed = new URL(url)
  assert.equal(parsed.host, 'postgres:5432')
  assert.equal(decodeURIComponent(parsed.username), 'api@user:1')
  assert.equal(decodeURIComponent(parsed.password), 'p@ss/w:rd#?%')
  assert.equal(parsed.pathname, '/dfr%2Fagon%3F')
  assert.equal(parsed.search, '')
})

test('IPv6 host는 대괄호로 감싸고 잘못된 host는 거절한다', () => {
  const configuration = {
    port: 5432,
    database: 'dfragon',
    username: 'dfragon_api',
    password: 'synthetic'
  }

  assert.equal(
    new URL(createDatabaseUrl({ ...configuration, host: '2001:db8::1234' })).hostname,
    '[2001:db8::1234]'
  )
  for (const host of ['postgres:5432', 'bad host', 'a/b']) {
    assert.throws(() => createDatabaseUrl({ ...configuration, host }), {
      message: 'Invalid database configuration'
    })
  }
})
