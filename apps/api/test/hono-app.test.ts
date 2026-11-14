import assert from 'node:assert/strict'
import test from 'node:test'
import { createHonoApp, createHonoAppHandle } from '@dfragon/http-server'
import { createNeopleClientForTest, createNeopleImageClientForTest } from '@dfragon/neople'

// Hono app handle을 만들면 global Response가 바뀌므로, 실제 fetch가 돌려주는 원래 class를 먼저 잡아 둔다.
const NativeResponse = globalThis.Response

function testApp() {
  return createHonoApp({
    accessLogService: 'test',
    writeAccessLog: () => undefined,
    toFailureResponse: () => ({ status: 500, body: { error: { code: 'COMMON_FAILURE' } } })
  })
}

test('Hono app handle을 만들어 global Response가 바뀐 뒤에도 Neople client가 JSON과 초상화를 읽고 초상화 크기 상한을 지킨다', async (t) => {
  const handle = createHonoAppHandle(testApp())
  t.after(() => handle.close())
  assert.notEqual(globalThis.Response, NativeResponse)
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const pngResponse = (body: Uint8Array<ArrayBuffer>) =>
    new NativeResponse(body, { headers: { 'Content-Type': 'image/png' } })
  const images = createNeopleImageClientForTest({
    fetch: async ({ url }) => {
      if (url.includes('/characters/oversized')) {
        return pngResponse(new Uint8Array(4 * 1024 * 1024 + 1))
      }

      return pngResponse(png)
    }
  })
  const neople = createNeopleClientForTest('fake-key', {
    fetch: async () => NativeResponse.json({ rows: [] })
  })
  const { signal } = new AbortController()

  const image = await images.characterImage({ serverId: 'cain', characterId: 'fixture' }, signal)
  const oversized = images.characterImage({ serverId: 'cain', characterId: 'oversized' }, signal)
  const search = await neople.searchCharacters('cain', {
    characterName: 'fixture',
    limit: 10,
    wordType: 'full'
  })

  assert.deepEqual(new Uint8Array(image), png)
  await assert.rejects(oversized, { name: 'NeopleRequestFailure', kind: 'api' })
  assert.deepEqual(search, { rows: [] })
})
