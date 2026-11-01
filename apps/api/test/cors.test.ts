import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createApiHttpApp } from '../src/http.js'

const unusedProvider = async (): Promise<never> => {
  throw new Error('CORS test must not call this provider')
}
const WEB_ORIGIN = 'https://dfragon.com'
const WEB_DEV_SITE_ORIGIN = 'https://dev.dfragon.com'

async function startApp(t: test.TestContext, webDevOrigins?: readonly string[]): Promise<string> {
  const app = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: { fetchDetails: unusedProvider, catalog: createCatalogService(unusedProvider) },
    todayGrade: { fetchShopGrade: unusedProvider },
    fetchCharacterImage: async () => Buffer.from('synthetic-portrait'),
    webDevOrigins,
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')

  return app.getUrl()
}

test('CORS는 dfragon.com, dev.dfragon.com과 지정한 로컬 웹 개발 origin의 GET과 preflight만 허용하고 다른 origin에는 header를 주지 않는다', async (t) => {
  const devOrigin = 'http://localhost:5173'
  const origin = await startApp(t, [devOrigin])

  for (const [allowed, path] of [
    [WEB_ORIGIN, '/health'],
    [WEB_ORIGIN, '/characters/cain/character_id-1/image'],
    [WEB_DEV_SITE_ORIGIN, '/health'],
    [WEB_DEV_SITE_ORIGIN, '/characters/cain/character_id-1/image'],
    [devOrigin, '/health']
  ]) {
    const response = await fetch(origin + path, { headers: { Origin: allowed } })

    assert.equal(response.status, 200, allowed)
    assert.equal(response.headers.get('access-control-allow-origin'), allowed)
    assert.match(response.headers.get('vary') ?? '', /Origin/)
  }

  for (const rejected of [
    'https://evil.example',
    'https://www.dfragon.com',
    'http://dfragon.com',
    'https://evil.dfragon.com',
    'http://dev.dfragon.com'
  ]) {
    const response = await fetch(`${origin}/health`, { headers: { Origin: rejected } })

    assert.equal(response.status, 200, rejected)
    assert.equal(response.headers.get('access-control-allow-origin'), null, rejected)
  }

  for (const allowed of [WEB_ORIGIN, WEB_DEV_SITE_ORIGIN]) {
    const preflight = await fetch(`${origin}/characters/candidates`, {
      method: 'OPTIONS',
      headers: { Origin: allowed, 'Access-Control-Request-Method': 'GET' }
    })
    assert.equal(preflight.status, 204, allowed)
    assert.equal(preflight.headers.get('access-control-allow-origin'), allowed)
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET')
  }

  const rejectedPreflight = await fetch(`${origin}/characters/candidates`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' }
  })
  assert.equal(rejectedPreflight.headers.get('access-control-allow-origin'), null)

  for (const allowed of [WEB_ORIGIN, WEB_DEV_SITE_ORIGIN]) {
    const simplePost = await fetch(`${origin}/characters/cain/character_id-1/refresh`, {
      method: 'POST',
      headers: { Origin: allowed }
    })
    assert.equal(simplePost.headers.get('access-control-allow-origin'), null, allowed)
  }
})

test('CORS는 로컬 웹 개발 origin을 지정하지 않으면 localhost origin을 허용하지 않는다', async (t) => {
  const origin = await startApp(t)

  const response = await fetch(`${origin}/health`, { headers: { Origin: 'http://localhost:5173' } })

  assert.equal(response.headers.get('access-control-allow-origin'), null)
})
