import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/application/character-catalog/service.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

test('제거된 경로는 404를 반환하고 provider를 호출하지 않는다', async (t) => {
  const unused = t.mock.fn(async (): Promise<never> => {
    throw new Error('removed routes must not call services')
  })
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused }
  })
  try {
    await app.listen(0, '127.0.0.1')
    const origin = await app.getUrl()
    for (const path of ['/auth/login/authorize', '/me']) {
      const response = await fetch(`${origin}${path}`)
      assert.equal(response.status, 404)
    }
    for (const path of [
      '/docs',
      '/docs/openapi.json',
      '/characters/cain/character-id/appearance',
      '/adventures/characters?adventureName=fixture'
    ]) {
      const response = await fetch(`${origin}${path}`)
      assert.equal(response.status, 404, path)
      assert.deepEqual(await response.json(), { statusCode: 404, message: 'Not Found' })
    }
    assert.equal(unused.mock.callCount(), 0)
  } finally {
    await app.close()
  }
})
