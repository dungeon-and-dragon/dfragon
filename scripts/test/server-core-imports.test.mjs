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
  ['domain/score/f.ts', '@dfragon/worker', '그 앱에 둔다'],
  ['application/character-catalog/a.ts', '@dfragon/api', '그 앱에 둔다'],
  ['application/character-catalog/d.ts', '@dfragon/worker/runtime/worker-jobs.js', '그 앱에 둔다'],
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
  ['infrastructure/score/c.ts', '@hono/node-server', '그 앱에 둔다'],
  ['infrastructure/score/d.ts', '@dfragon/worker/infrastructure/jobs/scheduler.js', '그 앱에 둔다']
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

const exporting = 'export const value = 1\nexport type Value = number\n'
// 기능 폴더 밖에서 import하는 대상 파일이 있어야 dependency-cruiser가 경로를 풀어 규칙을 적용한다.
const featureFolderTargets = Object.fromEntries(
  [
    'src/application/character-catalog/service.ts',
    'src/application/character-catalog/repository.ts',
    'src/application/character-catalog/ports.ts',
    'src/application/character-timeline/ports.ts',
    'src/domain/character-timeline/rows.ts',
    'src/domain/character-timeline/index.ts',
    'src/infrastructure/neople/character-catalog.ts',
    'src/infrastructure/neople/index.ts',
    'src/domain/seoul-time.ts'
  ].map((file) => [file, exporting])
)
const featureFolderCases = {
  rejected: [
    [
      'src/infrastructure/neople/a.ts',
      importing('../../application/character-catalog/service.js'),
      'feature-folder-index'
    ],
    [
      'src/application/character-catalog/a.ts',
      typeImporting('../../domain/character-timeline/rows.js'),
      'feature-folder-index'
    ],
    [
      'src/infrastructure/database/a.ts',
      importing('../neople/character-catalog.js'),
      'feature-folder-index'
    ],
    [
      'src/application/character-catalog/index.ts',
      `export { value } from './repository.js'\n`,
      'application-index-contract'
    ],
    [
      'src/application/character-timeline/index.ts',
      `export type { Value } from './ports.js'\n`,
      'application-index-contract'
    ]
  ],
  allowed: [
    ['src/infrastructure/database/b.ts', importing('../../application/character-catalog/index.js')],
    ['src/application/character-catalog/b.ts', importing('../../domain/seoul-time.js')],
    [
      'src/application/character-catalog/c.ts',
      typeImporting('../../domain/character-timeline/index.js')
    ],
    ['src/infrastructure/neople/b.ts', importing('./character-catalog.js')],
    ['src/infrastructure/database/c.ts', importing('../neople/index.js')],
    ['src/application/character-catalog/d.ts', importing('./service.js')],
    [
      'src/infrastructure/database/d.ts',
      typeImporting('../../application/character-catalog/repository.js')
    ],
    [
      'src/infrastructure/neople/c.ts',
      typeImporting('../../application/character-catalog/ports.js')
    ]
  ]
}
const featureFolderCruised = await cruiseAppSamples(
  {
    ...featureFolderTargets,
    ...Object.fromEntries(
      [...featureFolderCases.rejected, ...featureFolderCases.allowed].map(([file, source]) => [
        file,
        source
      ])
    )
  },
  { workspace: 'packages/server-core' }
)

for (const [file, , rule] of featureFolderCases.rejected) {
  test(`dependency-cruiser: server-core의 ${file} import를 ${rule}로 거부한다`, () => {
    assert.ok(featureFolderCruised.exitCode > 0)
    assert.deepEqual(
      featureFolderCruised.violations.filter(({ from }) => from === file),
      [{ from: file, rule }]
    )
  })
}

test('dependency-cruiser: server-core의 index.js, 같은 폴더 파일, 계층 폴더 바로 아래 파일, repository.ts와 ports.ts import는 허용한다', () => {
  const allowedFiles = new Set(featureFolderCases.allowed.map(([file]) => file))
  assert.deepEqual(
    featureFolderCruised.violations.filter(({ from }) => allowedFiles.has(from)),
    []
  )
})

test('dependency-cruiser: server-core 기능 폴더의 안쪽 파일을 직접 import하면 index.js로 가져오라고 알린다', () => {
  assert.ok(
    featureFolderCruised.text.includes("'../../application/<기능>/index.js'처럼 가져온다"),
    featureFolderCruised.text
  )
})

test('dependency-cruiser: server-core에서 실행할 때 생기는 순환 import를 no-circular로 거부한다', async () => {
  const result = await cruiseAppSamples(
    {
      'src/domain/score/a.ts': `import { b } from './b.js'\nexport const a = () => b\n`,
      'src/domain/score/b.ts': `import { a } from './a.js'\nexport const b = () => a\n`
    },
    { workspace: 'packages/server-core' }
  )
  assert.ok(result.exitCode > 0)
  assert.ok(result.violations.length > 0)
  assert.ok(
    result.violations.every(({ rule }) => rule === 'no-circular'),
    JSON.stringify(result.violations)
  )
})

test('dependency-cruiser: server-core에서 import type만으로 이은 순환은 허용한다', async () => {
  const result = await cruiseAppSamples(
    {
      'src/domain/score/c.ts': `import type { D } from './d.js'\nexport type C = { d?: D }\n`,
      'src/domain/score/d.ts': `import type { C } from './c.js'\nexport type D = { c?: C }\n`
    },
    { workspace: 'packages/server-core' }
  )
  assert.deepEqual(result.violations, [])
})
