import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lintSamples } from './fixtures/biome-lint.mjs'
import { cruiseApiSamples } from './fixtures/dependency-cruiser.mjs'

const src = 'apps/api/src'

function importing(source) {
  return `import { value } from '${source}'\nexport const used = value\n`
}

function typeImporting(source) {
  return `import type { Value } from '${source}'\nexport type Used = Value\n`
}

// [계층 파일, import 대상, 메시지에 있어야 할 옮길 위치]
const rejectedImports = [
  ['domain/today-grade/a.ts', '../../application/today-grade/service.js', 'application/<기능>/'],
  ['domain/today-grade/b.ts', '../../infrastructure/neople/today-grade.js', 'infrastructure/'],
  ['domain/today-grade/c.ts', '../../presentation/http/today-grade/routes.js', 'presentation/'],
  ['domain/today-grade/d.ts', '../../runtime/routes/api.js', 'application/<기능>/'],
  ['domain/today-grade/k.ts', 'hono', 'presentation/http/'],
  ['domain/today-grade/l.ts', 'hono/route', 'presentation/http/'],
  ['domain/today-grade/m.ts', '@hono/node-server', 'runtime/routes/'],
  ['domain/today-grade/g.ts', 'node:crypto', 'infrastructure/'],
  ['domain/today-grade/h.ts', 'node:fs/promises', 'infrastructure/'],
  ['application/today-grade/a.ts', '../../infrastructure/neople/today-grade.js', 'ports.ts'],
  ['application/today-grade/b.ts', '../../presentation/http/today-grade/failures.js', 'ports.ts'],
  ['application/today-grade/c.ts', '../../runtime/routes/api.js', '연결은 runtime/에'],
  ['application/today-grade/j.ts', 'hono', 'presentation/http/'],
  ['application/today-grade/k.ts', 'hono/body-limit', 'presentation/http/'],
  ['application/today-grade/l.ts', '@hono/node-server', 'runtime/routes/'],
  ['application/today-grade/e.ts', 'node:fs/promises', 'infrastructure/'],
  ['application/today-grade/f.ts', 'node:http', 'infrastructure/'],
  ['application/today-grade/g.ts', 'ky', 'infrastructure/'],
  [
    'infrastructure/neople/a.ts',
    '../../presentation/http/today-grade/failures.js',
    'presentation/http/'
  ],
  ['infrastructure/database/b.ts', '../../runtime/api-services.js', '연결은 runtime/에'],
  [
    'presentation/http/today-grade/a.ts',
    '../../../infrastructure/neople/today-grade.js',
    'application의 service'
  ],
  ['presentation/events/b.ts', '../../runtime/api-services.js', '연결은 runtime/에']
]

// node: 접두 없는 내장 module은 먼저 node:를 붙이게 해, 붙인 뒤 위 규칙이 계층별로 거부하게 한다.
const bareBuiltinImports = [
  ['domain/today-grade/i.ts', 'fs'],
  ['domain/today-grade/j.ts', 'crypto'],
  ['application/today-grade/h.ts', 'http'],
  ['application/today-grade/i.ts', 'fs/promises'],
  ['infrastructure/database/c.ts', 'fs'],
  ['presentation/http/today-grade/b.ts', 'crypto'],
  ['runtime/builtin.ts', 'fs'],
  ['main.ts', 'fs'],
  ['character-collector.ts', 'fs']
]

const allowedImports = [
  ['domain/today-grade/a.ts', './grade.js'],
  ['domain/today-grade/b.ts', '../error-chain.js'],
  ['domain/today-grade/c.ts', '@dfragon/lib'],
  ['domain/today-grade/d.ts', 'date-fns'],
  ['application/today-grade/a.ts', '../../domain/today-grade/failure.js'],
  ['application/today-grade/b.ts', './ports.js'],
  ['application/today-grade/c.ts', 'lru-cache'],
  ['infrastructure/neople/a.ts', '../../application/today-grade/ports.js'],
  ['infrastructure/neople/b.ts', '../../domain/today-grade/failure.js'],
  ['infrastructure/neople/c.ts', '@dfragon/neople'],
  ['infrastructure/database/d.ts', 'node:fs/promises'],
  ['infrastructure/database/e.ts', 'node:fs'],
  ['presentation/http/today-grade/a.ts', '../../../application/today-grade/service.js'],
  ['presentation/http/today-grade/d.ts', 'hono'],
  ['presentation/http/today-grade/e.ts', 'hono/route'],
  ['infrastructure/neople/d.ts', 'hono'],
  ['runtime/hono.ts', '@hono/node-server'],
  ['runtime/api-services.ts', '../infrastructure/neople/today-grade.js'],
  ['runtime/routes/a.ts', '../../presentation/http/today-grade/routes.js'],
  ['main.ts', './runtime/application.js'],
  ['character-collector.ts', './runtime/character-collector.js']
]

// 앱을 만드는 파일은 경로가 정해져 있어, 파일마다 import 여러 줄을 한 sample에 넣고 줄 번호로 진단을 맞춘다.
const appFiles = {
  'runtime/api-app.ts': {
    rejected: [
      '../characters/http.js',
      '../characters/search-service.js',
      '../score/engine.js',
      '../infrastructure/build-info.js',
      '../domain/character-failure.js',
      '../application/today-grade/service.js',
      '../infrastructure/neople/today-grade.js',
      '../presentation/http/today-grade/routes.js',
      '../presentation/http/character-search/failures.js',
      '../presentation/openapi/setup.js',
      './routes-not-allowed.js',
      './character-collector.js'
    ],
    allowed: [
      './routes/api.js',
      './api-services.js',
      './hono-app.js',
      './app-handle.js',
      '../presentation/http/character-failures.js',
      '../presentation/http/access-log-sink.js',
      'hono'
    ]
  },
  'runtime/ops-app.ts': {
    rejected: [
      '../application/jobs/run.js',
      '../domain/ops/failure.js',
      '../characters/http.js',
      '../presentation/http/ops/a.js'
    ],
    allowed: [
      './routes/ops.js',
      './hono-app.js',
      './app-handle.js',
      '../presentation/http/ops-failures.js',
      '../presentation/http/access-log-sink.js',
      'hono'
    ]
  }
}

function importingAll(sources) {
  const imports = sources.map((source, index) => `import { value${index} } from '${source}'`)
  const values = sources.map((_source, index) => `value${index}`)

  return `${imports.join('\n')}\nexport const used = [${values.join(', ')}]\n`
}

function appSamples(kind) {
  return Object.fromEntries(
    Object.entries(appFiles).map(([file, sources]) => [
      `${src}/${file}`,
      importingAll(sources[kind])
    ])
  )
}

const rejectedSources = Object.fromEntries(
  [...rejectedImports, ...bareBuiltinImports].map(([file, source]) => [
    `${src}/${file}`,
    importing(source)
  ])
)
const allowedSources = Object.fromEntries(
  allowedImports.map(([file, source]) => [`${src}/${file}`, importing(source)])
)
const typeOnlySource = `${src}/domain/today-grade/type-only.ts`
const biomeRejected = await lintSamples({ ...rejectedSources, ...appSamples('rejected') })
const biomeAllowed = await lintSamples({
  ...allowedSources,
  ...appSamples('allowed'),
  [typeOnlySource]: typeImporting('hono')
})

for (const [file, source, destination] of rejectedImports) {
  test(`Biome: ${file}에서 ${source} import를 거부하고 옮길 위치(${destination})를 알린다`, () => {
    const diagnostics = biomeRejected.get(`${src}/${file}`)
    assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics))
    assert.equal(diagnostics[0].category, 'lint/style/noRestrictedImports')
    assert.ok(diagnostics[0].message.includes(destination), diagnostics[0].message)
  })
}

for (const [file, source] of bareBuiltinImports) {
  test(`Biome: ${file}에서 node: 없이 쓴 ${source} import를 거부한다`, () => {
    const diagnostics = biomeRejected.get(`${src}/${file}`)
    assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics))
    assert.equal(diagnostics[0].category, 'lint/style/useNodejsImportProtocol')
  })
}

for (const [file, source] of allowedImports) {
  test(`Biome: ${file}에서 ${source} import를 허용한다`, () => {
    assert.deepEqual(biomeAllowed.get(`${src}/${file}`), [])
  })
}

for (const [file, { rejected, allowed }] of Object.entries(appFiles)) {
  test(`Biome: 앱을 만드는 ${file}에서 route를 모으는 파일이 아닌 기능 파일 import를 거부하고 runtime/routes/를 알린다`, () => {
    const diagnostics = biomeRejected.get(`${src}/${file}`)
    const reported = diagnostics
      .map(({ category, location }) => [category, location.start.line])
      .sort(([, left], [, right]) => left - right)
    assert.deepEqual(
      reported,
      rejected.map((_source, index) => ['lint/style/noRestrictedImports', index + 1])
    )
    for (const { message } of diagnostics) {
      assert.ok(message.includes('runtime/routes/<app>.ts'), message)
    }
  })

  test(`Biome: 앱을 만드는 ${file}에서 route를 모으는 파일, 앱 공통 설정, 공용 실패 표 import를 허용한다`, () => {
    assert.deepEqual(biomeAllowed.get(`${src}/${file}`), [], allowed.join(', '))
  })
}

test('Biome: domain은 import type이어도 Hono를 가져오지 못한다', () => {
  const diagnostics = biomeAllowed.get(typeOnlySource)
  assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics))
  assert.equal(diagnostics[0].category, 'lint/style/noRestrictedImports')
})

const packageCases = {
  rejected: [
    [
      'src/domain/today-grade/a.ts',
      importing('@dfragon/database'),
      'domain-application-package-value'
    ],
    [
      'src/domain/today-grade/b.ts',
      `export { value } from '@dfragon/neople'\n`,
      'domain-application-package-value'
    ],
    [
      'src/application/today-grade/a.ts',
      importing('@dfragon/neople'),
      'domain-application-package-value'
    ],
    [
      'src/application/today-grade/b.ts',
      `import { type Value, value } from '@dfragon/database'\nexport const used: Value = value\n`,
      'domain-application-package-value'
    ],
    [
      'src/presentation/http/today-grade/a.ts',
      importing('@dfragon/database'),
      'presentation-package-value'
    ]
  ],
  allowed: [
    ['src/domain/today-grade/c.ts', typeImporting('@dfragon/database')],
    ['src/application/today-grade/c.ts', typeImporting('@dfragon/neople')],
    ['src/presentation/http/today-grade/b.ts', typeImporting('@dfragon/neople')],
    ['src/infrastructure/neople/a.ts', importing('@dfragon/neople')],
    ['src/infrastructure/database/a.ts', importing('@dfragon/database')],
    ['src/runtime/api-services.ts', importing('@dfragon/database')],
    ['src/main.ts', importing('@dfragon/neople')],
    ['src/character-collector.ts', importing('@dfragon/database')]
  ]
}

const cruised = await cruiseApiSamples(
  Object.fromEntries(
    [...packageCases.rejected, ...packageCases.allowed].map(([file, source]) => [file, source])
  )
)

for (const [file, , rule] of packageCases.rejected) {
  test(`dependency-cruiser: ${file}의 package 값 import를 ${rule}로 거부한다`, () => {
    assert.deepEqual(
      cruised.violations.filter(({ from }) => from === file),
      [{ from: file, rule }]
    )
  })
}

test('dependency-cruiser: import type과 infrastructure, runtime, 진입 파일의 값 import는 허용한다', () => {
  const allowedFiles = new Set(packageCases.allowed.map(([file]) => file))
  assert.deepEqual(
    cruised.violations.filter(({ from }) => allowedFiles.has(from)),
    []
  )
})

test('dependency-cruiser: 위반 메시지가 값 import를 둘 위치를 알린다', () => {
  assert.match(
    cruised.text,
    /error domain-application-package-value: src\/domain\/today-grade\/a\.ts/
  )
  assert.ok(cruised.text.includes('infrastructure/database/, infrastructure/neople/'), cruised.text)
  assert.ok(cruised.text.includes('application의 service를 거친다'), cruised.text)
})

test('dependency-cruiser: package 소스를 찾지 못하면 통과시키지 않고 실패한다', async () => {
  const unresolved = await cruiseApiSamples(
    { 'src/domain/today-grade/a.ts': typeImporting('@dfragon/database') },
    { withPackages: false }
  )
  assert.deepEqual(unresolved.violations, [
    { from: 'src/domain/today-grade/a.ts', rule: 'unresolved-package' }
  ])
})

test('dependency-cruiser: 계층 밖 파일은 import 유무와 다른 파일에서의 사용 여부에 관계없이 실패한다', async () => {
  const result = await cruiseApiSamples({
    'src/unlayered.ts': importing('./domain/value.js'),
    'src/imported.ts': 'export const value = 1\n',
    'src/empty.ts': '',
    'src/old-folder/unused.ts': 'export const unused = 1\n',
    'src/main.ts.backup.ts': '',
    'src/character-collector.ts.backup.ts': '',
    'src/domain/value.ts': 'export const value = 1\n',
    'src/runtime/consumer.ts': importing('../imported.js')
  })
  assert.ok(result.exitCode > 0)
  assert.deepEqual(
    result.violations.sort((left, right) => left.from.localeCompare(right.from)),
    [
      { from: 'src/character-collector.ts.backup.ts', rule: 'api-source-location-orphan' },
      { from: 'src/empty.ts', rule: 'api-source-location-orphan' },
      { from: 'src/imported.ts', rule: 'api-source-location-connected' },
      { from: 'src/main.ts.backup.ts', rule: 'api-source-location-orphan' },
      { from: 'src/old-folder/unused.ts', rule: 'api-source-location-orphan' },
      { from: 'src/unlayered.ts', rule: 'api-source-location-connected' }
    ]
  )
  assert.ok(result.text.includes('계층 폴더 밖에는 진입 파일 main.ts, character-collector.ts만'))
})

test('dependency-cruiser: 진입 파일 둘과 다섯 계층 안의 import 없는 파일은 허용한다', async () => {
  const result = await cruiseApiSamples(
    Object.fromEntries(
      [
        'main.ts',
        'character-collector.ts',
        'domain/value.ts',
        'application/value.ts',
        'infrastructure/value.ts',
        'presentation/value.ts',
        'runtime/value.ts'
      ].map((file) => [`src/${file}`, ''])
    )
  )
  assert.equal(result.exitCode, 0)
  assert.deepEqual(result.violations, [])
})
