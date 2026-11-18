import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lintSamples } from './fixtures/biome-lint.mjs'
import { cruiseAppSamples } from './fixtures/dependency-cruiser.mjs'

const src = 'packages/server-core/src'

function importing(source) {
  return `import { value } from '${source}'\nexport const used = value\n`
}

function typeImporting(source) {
  return `import type { Value } from '${source}'\nexport type Used = Value\n`
}

// [계층 파일, import 대상, 메시지에 있어야 할 옮길 위치]
const rejectedImports = [
  ['domain/score/a.ts', '@dfragon/http-server', '그 앱에 둔다'],
  ['domain/score/b.ts', 'hono', '그 앱에 둔다'],
  ['domain/score/c.ts', '../../infrastructure/score/engine.js', 'infrastructure/'],
  ['domain/score/d.ts', '../../application/character-catalog/ports.js', 'application/<기능>/'],
  ['domain/score/e.ts', 'node:fs', 'infrastructure/'],
  ['application/character-catalog/a.ts', '@dfragon/api', '그 앱에 둔다'],
  [
    'application/character-catalog/b.ts',
    '../../infrastructure/neople/character-catalog.js',
    'ports.ts'
  ],
  ['application/character-catalog/c.ts', 'koffi', 'infrastructure/'],
  [
    'infrastructure/score/a.ts',
    '../../../../../apps/api/src/runtime/api-services.js',
    '그 앱에 둔다'
  ],
  ['infrastructure/score/b.ts', '@dfragon/http-server', '그 앱에 둔다'],
  ['infrastructure/score/c.ts', '@hono/node-server', '그 앱에 둔다']
]
const allowedImports = [
  ['domain/score/a.ts', './result.js'],
  ['domain/score/b.ts', '@dfragon/lib/error-chain'],
  ['application/character-catalog/a.ts', '../../domain/character-catalog/types.js'],
  ['application/character-catalog/b.ts', 'lru-cache'],
  ['infrastructure/score/a.ts', '../../domain/score/input.js'],
  ['infrastructure/score/b.ts', 'koffi'],
  ['infrastructure/neople/a.ts', '@dfragon/neople'],
  ['infrastructure/database/a.ts', 'node:fs']
]

const samples = (cases) =>
  Object.fromEntries(cases.map(([file, source]) => [`${src}/${file}`, importing(source)]))
const rejected = await lintSamples(samples(rejectedImports))
const allowed = await lintSamples(samples(allowedImports))

for (const [file, source, destination] of rejectedImports) {
  test(`Biome: server-core의 ${file}에서 ${source} import를 거부하고 둘 위치(${destination})를 알린다`, () => {
    const diagnostics = rejected.get(`${src}/${file}`)
    assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics))
    assert.equal(diagnostics[0].category, 'lint/style/noRestrictedImports')
    assert.ok(diagnostics[0].message.includes(destination), diagnostics[0].message)
  })
}

for (const [file, source] of allowedImports) {
  test(`Biome: server-core의 ${file}에서 ${source} import를 허용한다`, () => {
    assert.deepEqual(allowed.get(`${src}/${file}`), [])
  })
}

test('Biome: server-core에서 node: 없이 쓴 내장 module import를 거부한다', async () => {
  const file = `${src}/infrastructure/score/builtin.ts`
  const diagnostics = await lintSamples({ [file]: importing('worker_threads') })
  assert.deepEqual(
    diagnostics.get(file).map(({ category }) => category),
    ['lint/style/useNodejsImportProtocol']
  )
})

const packageCases = {
  rejected: [
    ['src/domain/score/a.ts', importing('@dfragon/database')],
    ['src/application/character-catalog/a.ts', importing('@dfragon/neople')],
    [
      'src/application/content-clears/a.ts',
      `import { type Value, value } from '@dfragon/database'\nexport const used: Value = value\n`
    ]
  ],
  allowed: [
    ['src/domain/score/b.ts', typeImporting('@dfragon/neople')],
    ['src/application/character-catalog/b.ts', typeImporting('@dfragon/database')],
    ['src/infrastructure/database/a.ts', importing('@dfragon/database')],
    ['src/infrastructure/neople/a.ts', importing('@dfragon/neople')]
  ]
}
const cruised = await cruiseAppSamples(
  Object.fromEntries([...packageCases.rejected, ...packageCases.allowed]),
  { workspace: 'packages/server-core' }
)

for (const [file] of packageCases.rejected) {
  test(`dependency-cruiser: server-core의 ${file}에서 package 값 import를 거부한다`, () => {
    assert.deepEqual(
      cruised.violations.filter(({ from }) => from === file),
      [{ from: file, rule: 'domain-application-package-value' }]
    )
  })
}

test('dependency-cruiser: server-core의 import type과 infrastructure의 값 import는 허용한다', () => {
  const allowedFiles = new Set(packageCases.allowed.map(([file]) => file))
  assert.deepEqual(
    cruised.violations.filter(({ from }) => allowedFiles.has(from)),
    []
  )
})

test('dependency-cruiser: server-core에서 package 소스를 찾지 못하면 통과시키지 않고 실패한다', async () => {
  const unresolved = await cruiseAppSamples(
    { 'src/domain/score/a.ts': typeImporting('@dfragon/database') },
    { workspace: 'packages/server-core', withPackages: false }
  )
  assert.deepEqual(unresolved.violations, [
    { from: 'src/domain/score/a.ts', rule: 'unresolved-package' }
  ])
})

test('dependency-cruiser: server-core의 계층 밖 파일은 실패한다', async () => {
  const result = await cruiseAppSamples(
    {
      'src/unlayered.ts': importing('./domain/value.js'),
      'src/imported.ts': 'export const value = 1\n',
      'src/empty.ts': '',
      'src/runtime/value.ts': '',
      'src/domain/value.ts': 'export const value = 1\n',
      'src/application/value.ts': '',
      'src/infrastructure/value.ts': '',
      'src/infrastructure/consumer.ts': importing('../imported.js')
    },
    { workspace: 'packages/server-core' }
  )
  assert.ok(result.exitCode > 0)
  assert.deepEqual(
    result.violations.sort((left, right) => left.from.localeCompare(right.from)),
    [
      { from: 'src/empty.ts', rule: 'server-core-source-location-orphan' },
      { from: 'src/imported.ts', rule: 'server-core-source-location-connected' },
      { from: 'src/runtime/value.ts', rule: 'server-core-source-location-orphan' },
      { from: 'src/unlayered.ts', rule: 'server-core-source-location-connected' }
    ]
  )
})
