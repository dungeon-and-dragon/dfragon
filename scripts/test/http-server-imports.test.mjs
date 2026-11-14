import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lintSamples } from './fixtures/biome-lint.mjs'

const src = 'packages/http-server/src'

function importing(source) {
  return `import { value } from '${source}'\nexport const used = value\n`
}

const rejectedImports = [
  '@dfragon/api',
  '@dfragon/database',
  '@dfragon/neople',
  '../../../apps/api/src/runtime/api-app.js'
]
const allowedImports = ['@dfragon/lib/error-chain', 'hono', '@hono/node-server', './access-log.js']

const samples = (sources) =>
  Object.fromEntries(
    sources.map((source, index) => [`${src}/sample-${index}.ts`, importing(source)])
  )
const rejected = await lintSamples(samples(rejectedImports))
const allowed = await lintSamples(samples(allowedImports))

for (const [index, source] of rejectedImports.entries()) {
  test(`Biome: 공용 HTTP package에서 ${source} import를 거부하고 앱에 둘 코드를 알린다`, () => {
    const diagnostics = rejected.get(`${src}/sample-${index}.ts`)
    assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics))
    assert.equal(diagnostics[0].category, 'lint/style/noRestrictedImports')
    assert.ok(diagnostics[0].message.includes('createHonoApp의 option'), diagnostics[0].message)
  })
}

for (const [index, source] of allowedImports.entries()) {
  test(`Biome: 공용 HTTP package에서 ${source} import를 허용한다`, () => {
    assert.deepEqual(allowed.get(`${src}/sample-${index}.ts`), [])
  })
}

test('Biome: 공용 HTTP package에서 node: 없이 쓴 내장 module import를 거부한다', async () => {
  const diagnostics = await lintSamples({ [`${src}/builtin.ts`]: importing('http') })
  assert.deepEqual(
    diagnostics.get(`${src}/builtin.ts`).map(({ category }) => category),
    ['lint/style/useNodejsImportProtocol']
  )
})
