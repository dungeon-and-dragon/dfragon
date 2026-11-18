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
