import assert from 'node:assert/strict'
import test from 'node:test'
import { withSearchApp, expectSearchError } from './character-search-fixtures.mjs'

test('공개 검색은 loopback 공급자의 후보를 정제한다', async () => {
  await withSearchApp(async ({ base, calls, upstream }) => {
    upstream.body = {
      rows: [
        {
          characterId: 'candidate',
          characterName: '가나',
          serverId: 'cain',
          fame: 0,
          privateField: 'excluded'
        },
        { characterId: 'middle', characterName: '다가나', serverId: 'cain', fame: 9 }
      ]
    }
    const response = await fetch(`${base}/characters?characterName=%EA%B0%80%EB%82%98`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      rows: [
        {
          characterId: 'candidate',
          characterName: '가나',
          serverId: 'cain',
          serverName: '카인',
          fame: 0,
          jobName: null,
          jobGrowName: null,
          imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/candidate?zoom=1'
        }
      ]
    })
    assert.deepEqual(calls, [
      {
        path: '/df/servers/all/characters',
        query: { characterName: '가나', limit: '10', wordType: 'full' },
        hasExpectedKey: true
      }
    ])
  })
})

test('한 글자 공개 검색은 공급자를 match로 부르고 이름이 같은 캐릭터만 반환한다', async () => {
  await withSearchApp(async ({ base, calls, upstream }) => {
    upstream.body = {
      rows: [
        { characterId: 'lower', characterName: 'a', serverId: 'cain', fame: 10 },
        { characterId: 'upper', characterName: 'A', serverId: 'prey', fame: 20 }
      ]
    }
    const response = await fetch(`${base}/characters?characterName=a`)
    assert.equal(response.status, 200)
    const { rows } = await response.json()
    assert.deepEqual(
      rows.map(({ characterId, characterName }) => ({ characterId, characterName })),
      [{ characterId: 'lower', characterName: 'a' }]
    )
    assert.deepEqual(
      calls.map(({ query }) => query),
      [{ characterName: 'a', limit: '10', wordType: 'match' }]
    )
  })
})

test('잘못된 공개 검색 query는 공급자를 호출하지 않는다', async () => {
  await withSearchApp(async ({ base, calls }) => {
    await expectSearchError(
      await fetch(`${base}/characters?unknown=%FF`),
      400,
      'INVALID_SEARCH_QUERY'
    )
    await expectSearchError(
      await fetch(`${base}/characters?characterName=ab&limit=1&%6Cimit=2`),
      400,
      'INVALID_SEARCH_QUERY'
    )
    await expectSearchError(
      await fetch(`${base}/characters?characterName=%FF`),
      400,
      'INVALID_SEARCH_QUERY'
    )
    assert.deepEqual(calls, [])
  })
})
