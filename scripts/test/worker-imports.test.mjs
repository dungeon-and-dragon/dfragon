import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lintSamples } from './fixtures/biome-lint.mjs'
import { cruiseAppSamples } from './fixtures/dependency-cruiser.mjs'

const api = 'apps/api'
const worker = 'apps/worker'

function importing(source) {
  return `import { value } from '${source}'\nexport const used = value\n`
}

function typeImporting(source) {
  return `import type { Value } from '${source}'\nexport type Used = Value\n`
}

// [파일, import 대상, 메시지에 있어야 할 문구]
const boundary = '함께 쓰는 코드는 @dfragon/server-core에 둔다'
const rejectedImports = [
  [`${api}/src/runtime/a.ts`, '@dfragon/worker/runtime/run-character-collector.js', boundary],
  [`${api}/src/main.ts`, '@dfragon/worker/runtime/run-character-collector.js', boundary],
  [`${api}/src/domain/today-grade/a.ts`, '@dfragon/worker/domain/ranking-stats/stats.js', boundary],
  [`${api}/src/application/today-grade/a.ts`, '@dfragon/worker', boundary],
  [
    `${api}/src/infrastructure/database/a.ts`,
    '@dfragon/worker/infrastructure/database/stats-jobs.js',
    boundary
  ],
  [`${api}/src/presentation/http/today-grade/a.ts`, '@dfragon/worker/domain/x.js', boundary],
  [`${api}/src/runtime/api-app.ts`, '@dfragon/worker/runtime/worker-jobs.js', boundary],
  [`${api}/test/a.test.ts`, '../../worker/src/runtime/worker-jobs.js', boundary],
  [`${worker}/src/runtime/a.ts`, '@dfragon/api', boundary],
  [`${worker}/src/runtime/b.ts`, '../../../api/src/runtime/api-services.js', boundary],
  [`${worker}/src/domain/jobs/a.ts`, '../../../../apps/api/src/domain/character-row.js', boundary],
  [`${worker}/src/application/jobs/a.ts`, '@dfragon/api/src/domain/character-row.js', boundary],
  [`${worker}/test/a.test.ts`, '../../api/src/runtime/api-services.js', boundary],
  [`${worker}/test/b.test.ts`, '../../api/test/fixtures.js', boundary],
  [`${worker}/test/c.test.ts`, '../../api/dist/runtime/api-services.js', boundary],
  [`${api}/test/b.test.ts`, '../../worker/test/fixtures.js', boundary],
  [`${api}/test-support/verify-sample.mjs`, '@dfragon/worker/application/jobs/run.js', boundary],
  [
    `${api}/src/character-collector.ts`,
    '@dfragon/worker/runtime/run-character-collector.js',
    boundary
  ],
  [
    `${api}/test-support/container-sample-check.mjs`,
    '@dfragon/worker/application/jobs/run.js',
    boundary
  ],
  // worker 경계 규칙이 함께 걸려도 계층 규칙이 그대로 남는지 확인한다.
  [`${worker}/src/domain/jobs/b.ts`, '../../application/jobs/run.js', 'application/<기능>/'],
  [`${worker}/src/domain/jobs/c.ts`, 'node:fs', 'infrastructure/'],
  [`${worker}/src/application/jobs/b.ts`, '../../infrastructure/jobs/scheduler.js', 'ports.ts'],
  [`${worker}/src/application/jobs/c.ts`, 'node:worker_threads', 'infrastructure/'],
  [`${worker}/src/infrastructure/jobs/a.ts`, '../../runtime/worker-jobs.js', '연결은 runtime/에'],
  [
    `${api}/src/domain/today-grade/b.ts`,
    '../../application/today-grade/service.js',
    'application/<기능>/'
  ],
  [`${api}/src/application/today-grade/b.ts`, 'koffi', 'infrastructure/']
]
const allowedImports = [
  [`${worker}/src/main.ts`, './runtime/run-character-collector.js'],
  [`${worker}/src/runtime/a.ts`, '@dfragon/server-core/infrastructure/score/engine.js'],
  [`${worker}/src/application/jobs/a.ts`, '@dfragon/server-core/domain/seoul-time.js'],
  [`${worker}/src/infrastructure/neople/a.ts`, '@dfragon/neople'],
  [`${worker}/test/a.test.ts`, '@dfragon/server-core/test/score-fixtures.js']
]

const samples = (cases) =>
  Object.fromEntries(cases.map(([file, source]) => [file, importing(source)]))
const rejected = await lintSamples(samples(rejectedImports))
const allowed = await lintSamples(samples(allowedImports))

for (const [file, source, message] of rejectedImports) {
  test(`Biome: ${file}에서 ${source} import를 거부하고 옮길 위치(${message})를 알린다`, () => {
    const diagnostics = rejected.get(file)
    assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics))
    assert.equal(diagnostics[0].category, 'lint/style/noRestrictedImports')
    assert.ok(diagnostics[0].message.includes(message), diagnostics[0].message)
  })
}

for (const [file, source] of allowedImports) {
  test(`Biome: ${file}에서 ${source} import를 허용한다`, () => {
    assert.deepEqual(allowed.get(file), [])
  })
}

test('Biome: worker에서 node: 없이 쓴 내장 module import를 거부한다', async () => {
  const file = `${worker}/src/infrastructure/files/builtin.ts`
  const diagnostics = await lintSamples({ [file]: importing('fs') })
  assert.deepEqual(
    diagnostics.get(file).map(({ category }) => category),
    ['lint/style/useNodejsImportProtocol']
  )
})

const packageCases = {
  rejected: [
    ['src/domain/jobs/a.ts', importing('@dfragon/database')],
    ['src/application/jobs/a.ts', importing('@dfragon/neople')]
  ],
  allowed: [
    ['src/domain/jobs/b.ts', typeImporting('@dfragon/database')],
    ['src/application/jobs/b.ts', typeImporting('@dfragon/neople')],
    ['src/infrastructure/database/a.ts', importing('@dfragon/database')],
    ['src/runtime/a.ts', importing('@dfragon/neople')],
    ['src/main.ts', importing('./runtime/a.js')]
  ]
}
const cruised = await cruiseAppSamples(
  Object.fromEntries([...packageCases.rejected, ...packageCases.allowed]),
  { app: 'worker' }
)

for (const [file] of packageCases.rejected) {
  test(`dependency-cruiser: worker의 ${file}에서 package 값 import를 거부한다`, () => {
    assert.deepEqual(
      cruised.violations.filter(({ from }) => from === file),
      [{ from: file, rule: 'domain-application-package-value' }]
    )
  })
}

test('dependency-cruiser: worker의 import type과 infrastructure, runtime, 진입 파일의 값 import는 허용한다', () => {
  const allowedFiles = new Set(packageCases.allowed.map(([file]) => file))
  assert.deepEqual(
    cruised.violations.filter(({ from }) => allowedFiles.has(from)),
    []
  )
})

test('dependency-cruiser: worker에서 package 소스를 찾지 못하면 통과시키지 않고 실패한다', async () => {
  const unresolved = await cruiseAppSamples(
    { 'src/domain/jobs/a.ts': typeImporting('@dfragon/database') },
    { app: 'worker', withPackages: false }
  )
  assert.deepEqual(unresolved.violations, [
    { from: 'src/domain/jobs/a.ts', rule: 'unresolved-package' }
  ])
})

test('dependency-cruiser: worker의 계층 밖 파일과 presentation 폴더는 import 유무와 관계없이 실패한다', async () => {
  const result = await cruiseAppSamples(
    {
      'src/unlayered.ts': importing('./domain/value.js'),
      'src/imported.ts': 'export const value = 1\n',
      'src/empty.ts': '',
      'src/presentation/value.ts': '',
      'src/character-collector.ts': '',
      'src/domain/value.ts': 'export const value = 1\n',
      'src/application/value.ts': '',
      'src/infrastructure/value.ts': '',
      'src/runtime/consumer.ts': importing('../imported.js'),
      'src/main.ts': ''
    },
    { app: 'worker' }
  )
  assert.ok(result.exitCode > 0)
  assert.deepEqual(
    result.violations.sort((left, right) => left.from.localeCompare(right.from)),
    [
      { from: 'src/character-collector.ts', rule: 'worker-source-location-orphan' },
      { from: 'src/empty.ts', rule: 'worker-source-location-orphan' },
      { from: 'src/imported.ts', rule: 'worker-source-location-connected' },
      { from: 'src/presentation/value.ts', rule: 'worker-source-location-orphan' },
      { from: 'src/unlayered.ts', rule: 'worker-source-location-connected' }
    ]
  )
})

const exporting = 'export const value = 1\nexport type Value = number\n'
// 기능 폴더 밖에서 import하는 대상 파일이 있어야 dependency-cruiser가 경로를 풀어 규칙을 적용한다.
const featureFolderTargets = Object.fromEntries(
  [
    'src/application/ranking-stats/service.ts',
    'src/application/ranking-stats/repository.ts',
    'src/application/ranking-stats/ports.ts',
    'src/application/character-score/ports.ts',
    'src/domain/ranking-stats/stats.ts',
    'src/infrastructure/jobs/scheduler.ts',
    'src/infrastructure/jobs/index.ts',
    'src/domain/failure.ts'
  ].map((file) => [file, exporting])
)
const featureFolderCases = {
  rejected: [
    [
      'src/runtime/worker-jobs.ts',
      importing('../application/ranking-stats/service.js'),
      'feature-folder-index'
    ],
    [
      'src/infrastructure/database/a.ts',
      typeImporting('../../domain/ranking-stats/stats.js'),
      'feature-folder-index'
    ],
    [
      'src/runtime/scheduler.ts',
      importing('../infrastructure/jobs/scheduler.js'),
      'feature-folder-index'
    ],
    [
      'src/application/ranking-stats/index.ts',
      `export { value } from './repository.js'\n`,
      'application-index-contract'
    ],
    [
      'src/application/character-score/index.ts',
      `export type { Value } from './ports.js'\n`,
      'application-index-contract'
    ]
  ],
  allowed: [
    ['src/runtime/stats-jobs.ts', importing('../application/ranking-stats/index.js')],
    ['src/application/ranking-stats/b.ts', importing('../../domain/failure.js')],
    ['src/infrastructure/jobs/a.ts', importing('./scheduler.js')],
    ['src/runtime/jobs.ts', importing('../infrastructure/jobs/index.js')],
    ['src/application/ranking-stats/a.ts', importing('./service.js')],
    [
      'src/infrastructure/database/b.ts',
      importing('../../application/ranking-stats/repository.js')
    ],
    ['src/infrastructure/neople/a.ts', typeImporting('../../application/ranking-stats/ports.js')],
    ['src/runtime/character-collector.ts', importing('../application/ranking-stats/ports.js')]
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
  { app: 'worker' }
)

for (const [file, , rule] of featureFolderCases.rejected) {
  test(`dependency-cruiser: ${file}의 import를 ${rule}로 거부한다`, () => {
    assert.deepEqual(
      featureFolderCruised.violations.filter(({ from }) => from === file),
      [{ from: file, rule }]
    )
  })
}

test('dependency-cruiser: 기능 폴더의 index.js, 같은 폴더 파일, 계층 폴더 바로 아래 파일, repository.ts와 ports.ts import는 허용한다', () => {
  const allowedFiles = new Set(featureFolderCases.allowed.map(([file]) => file))
  assert.deepEqual(
    featureFolderCruised.violations.filter(({ from }) => allowedFiles.has(from)),
    []
  )
})

test('dependency-cruiser: 기능 폴더 안쪽 파일을 직접 import하면 index.js로 가져오라고 알린다', () => {
  assert.ok(
    featureFolderCruised.text.includes("'../../application/<기능>/index.js'처럼 가져온다"),
    featureFolderCruised.text
  )
})

test('dependency-cruiser: 실행할 때 생기는 순환 import를 no-circular로 거부한다', async () => {
  const result = await cruiseAppSamples(
    {
      'src/domain/ranking-stats/a.ts': `import { b } from './b.js'\nexport const a = () => b\n`,
      'src/domain/ranking-stats/b.ts': `import { a } from './a.js'\nexport const b = () => a\n`
    },
    { app: 'worker' }
  )
  assert.ok(result.exitCode > 0)
  assert.ok(result.violations.length > 0)
  assert.ok(
    result.violations.every(({ rule }) => rule === 'no-circular'),
    JSON.stringify(result.violations)
  )
})

test('dependency-cruiser: import type만으로 이은 순환은 허용한다', async () => {
  const result = await cruiseAppSamples(
    {
      'src/domain/ranking-stats/c.ts': `import type { D } from './d.js'\nexport type C = { d?: D }\n`,
      'src/domain/ranking-stats/d.ts': `import type { C } from './c.js'\nexport type D = { c?: C }\n`
    },
    { app: 'worker' }
  )
  assert.deepEqual(result.violations, [])
})
