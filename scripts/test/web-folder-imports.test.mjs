import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { lintSamples } from './fixtures/biome-lint.mjs'

const src = 'apps/web/src'
const captureLib = 'features/capture-search/lib'
const rejectedImports = [
  ['pages/a/dynamic.ts', '../shared', '#<폴더>/...', "export const used = import('../shared')\n"],
  [
    'pages/a/type.ts',
    '../shared',
    '#<폴더>/...',
    "import type { Value } from '../shared'\nexport type Used = Value\n"
  ],
  ['pages/a/export.ts', '../shared', '#<폴더>/...', "export { value } from '../shared'\n"],
  ['pages/a/parent.ts', '../shared', '#<폴더>/...'],
  ['pages/a/deep.ts', '../../../hooks/useShared', '#<폴더>/...'],
  [`${captureLib}/search/parent.ts`, '../capture/cards', '#<폴더>/...'],
  ['widgets/a/ui/parent.ts', '../model/store', '#<폴더>/...'],
  [`${captureLib}/page-alias.ts`, '#pages/a', captureLib],
  [`${captureLib}/app-alias.ts`, '#app/router', captureLib],
  [`${captureLib}/widget-alias.ts`, '#widgets/global-bar', captureLib],
  [`${captureLib}/shared-ui-alias.ts`, '#shared/ui/ListBox', captureLib],
  [`${captureLib}/feature-alias.ts`, '#features/favorite', captureLib],
  [`${captureLib}/animation-alias.ts`, '#shared/lib/animations/gsap-motion', captureLib],
  [`${captureLib}/ocr/react.ts`, 'react', captureLib],
  [`${captureLib}/ocr/react-dom.ts`, 'react-dom', captureLib],
  [`${captureLib}/capture/ui.ts`, '@dfragon/ui', captureLib]
]
const allowedImports = [
  ['pages/a/same.ts', './local'],
  [`${captureLib}/same-folder.ts`, './browser-png']
]

function importing(source) {
  return `import { value } from '${source}'\nexport const used = value\n`
}

function samples(cases) {
  return Object.fromEntries(
    cases.map(([file, source, , code]) => [`${src}/${file}`, code ?? importing(source)])
  )
}

const rejected = await lintSamples(samples(rejectedImports))
const allowedSamples = samples(allowedImports)
const parentImport = importing('../shared')
const allowed = await lintSamples({
  ...allowedSamples,
  'apps/web/vite.config.ts': parentImport,
  'apps/storybook/src/allowed.ts': parentImport
})

test('Biome: 웹 설정과 다른 앱의 상위 폴더 상대 경로는 허용한다', () => {
  assert.deepEqual(allowed.get('apps/web/vite.config.ts'), [])
  assert.deepEqual(allowed.get('apps/storybook/src/allowed.ts'), [])
})

for (const [file, source, destination] of rejectedImports) {
  test(`Biome: ${file}에서 ${source} import를 거부하고 ${destination} 위치를 알린다`, () => {
    const diagnostics = rejected.get(`${src}/${file}`)
    assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics))
    assert.equal(diagnostics[0].category, 'lint/style/noRestrictedImports')
    assert.ok(diagnostics[0].message.includes(destination), diagnostics[0].message)
  })
}

for (const [file, source] of allowedImports) {
  test(`Biome: ${file}에서 ${source} import를 허용한다`, () => {
    assert.deepEqual(allowed.get(`${src}/${file}`), [])
  })
}

const layerRejected = [
  ['src/shared/ui/upper.ts', '#entities/character', 'layer-imports'],
  ['src/entities/character/upper.ts', '#features/favorite', 'layer-imports'],
  ['src/features/favorite/upper.ts', '#widgets/global-bar', 'layer-imports'],
  ['src/widgets/global-bar/upper.ts', '#pages/b', 'layer-imports'],
  ['src/pages/a/app.ts', '#app/router', 'layer-imports'],
  ['src/pages/a/index-import.ts', '#pages/b', 'slice-imports'],
  ['src/pages/a/relative-inner.ts', '../b/hooks/useThing', 'slice-imports'],
  ['src/pages/a/alias-inner.ts', '#pages/b/hooks/useThing', 'slice-imports'],
  ['src/pages/home/rankings.ts', '#pages/rankings', 'slice-imports'],
  ['src/pages/home/rankings.test.ts', '#pages/rankings', 'slice-imports'],
  ['src/pages/home/rankings.stories.tsx', '#pages/rankings', 'slice-imports'],
  ['src/widgets/global-bar/other-slice.ts', '#widgets/site-footer', 'slice-imports'],
  ['src/features/favorite/other-slice.ts', '#features/color-mode', 'slice-imports'],
  ['src/entities/character/other-slice.ts', '#entities/ranking', 'slice-imports'],
  ['src/entities/character/other-x.ts', '#entities/ranking/@x/guild', 'slice-imports'],
  ['src/app/page-inner.ts', '#pages/b/BPage', 'slice-index'],
  ['src/app/page-inner-tsx.ts', '#pages/b/BPage.tsx', 'slice-index'],
  ['src/testing/story.ts', '#pages/b/BPage.tsx', 'slice-index'],
  ['src/pages/a/feature-inner.ts', '#features/favorite/ui/FavoriteToggle', 'slice-index'],
  ['src/pages/a/inner.test.ts', '#entities/character/model/character', 'slice-index'],
  [
    'src/entities/character/model/uses-fixture.ts',
    '#entities/character/api/character.fixture',
    'fixture-imports'
  ],
  ['src/pages/a/uses-fixture.ts', '#entities/character/api/character.fixture', 'fixture-imports'],
  ['src/pages/a/uses-testing.ts', '#testing/fixture', 'testing-imports'],
  ['src/shared/lib/uses-testing.ts', '#testing/fixture', 'testing-imports']
]

const layerAllowed = [
  ['src/app/router.ts', '#pages/b'],
  ['src/pages/a/widget.ts', '#widgets/global-bar'],
  ['src/widgets/global-bar/feature.ts', '#features/favorite'],
  ['src/features/favorite/entity.ts', '#entities/character'],
  ['src/entities/character/shared.ts', '#shared/ui/ListBox'],
  ['src/entities/guild/cross.ts', '#entities/character/@x/guild'],
  ['src/features/favorite/same-slice.ts', './ui/FavoriteToggle'],
  ['src/features/favorite/ui/same-slice-alias.ts', '#features/favorite/model/store'],
  ['src/pages/a/same.ts', './hooks/useThing'],
  ['src/pages/a/one/same.ts', '#pages/a/hooks/useThing'],
  ['src/shared/ui/segment.ts', '#shared/lib/time-format'],
  ['src/pages/a/fixture.test.ts', '#entities/character/api/character.fixture'],
  ['src/pages/a/handler.stories.tsx', '#entities/character/api/character.handlers'],
  ['src/entities/character/api/character.handlers.ts', './character.fixture'],
  ['src/entities/ranking/model/other-entity.test.ts', '#entities/character/api/character.fixture'],
  ['src/pages/a/api/a.fixture.ts', '#entities/character/api/character.fixture'],
  ['src/pages/a/api/b.fixture.ts', '#testing/fixture'],
  ['src/pages/a/uses-testing.test.ts', '#testing/fixture'],
  ['src/testing/story-support/frame.ts', '#entities/character/api/character.fixture']
]

const aliasAllowed = [
  ['src/pages/a/asset.ts', '#shared/assets/logo.png', 'src/shared/assets/logo.png'],
  ['src/pages/a/shared-ui.ts', '#shared/ui/ListBox', 'src/shared/ui/ListBox.tsx'],
  ['src/pages/a/testing.test.ts', '#testing/fixture', 'src/testing/fixture.tsx'],
  ['src/app/other-screen.ts', '#pages/b', 'src/pages/b/index.ts'],
  ['src/pages/a/same-screen.ts', '#pages/a/hooks/useThing', 'src/pages/a/hooks/useThing.ts']
]

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))
const depcruise = fileURLToPath(
  new URL('../../bin/dependency-cruiser.mjs', import.meta.resolve('dependency-cruiser'))
)

async function cruiseSamples() {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-web-depcruise-'))
  const web = join(directory, 'apps/web')

  try {
    await mkdir(web, { recursive: true })
    for (const file of [
      '.dependency-cruiser.mjs',
      'tsconfig.app.json',
      'tsconfig.paths.json',
      'package.json'
    ]) {
      await cp(join(root, 'apps/web', file), join(web, file))
    }

    const files = Object.fromEntries(
      [...aliasAllowed, ...layerRejected, ...layerAllowed].map(([file, source, , code]) => [
        file,
        code ?? importing(source)
      ])
    )

    for (const file of [
      'src/shared/assets/logo.png',
      'src/shared/ui/ListBox.tsx',
      'src/shared/lib/time-format.ts',
      'src/testing/fixture.tsx',
      'src/pages/a/hooks/useThing.ts',
      'src/pages/b/hooks/useThing.ts',
      'src/pages/b/BPage.tsx',
      'src/pages/rankings/RankingsScreen.tsx',
      'src/widgets/global-bar/index.ts',
      'src/widgets/site-footer/index.ts',
      'src/features/favorite/index.ts',
      'src/features/favorite/ui/FavoriteToggle.tsx',
      'src/features/favorite/model/store.ts',
      'src/features/color-mode/index.ts',
      'src/entities/character/index.ts',
      'src/entities/character/@x/guild.ts',
      'src/entities/character/model/character.ts',
      'src/entities/character/api/character.fixture.ts',
      'src/entities/ranking/index.ts',
      'src/entities/ranking/@x/guild.ts'
    ]) {
      files[file] = 'export const value = 1\n'
    }

    files['src/pages/b/index.ts'] = "export { value } from './BPage'\n"
    files['src/pages/rankings/index.ts'] = "export { value } from './RankingsScreen'\n"
    files['src/cycles/value-a.ts'] =
      "import { b } from './value-b'\nexport function a() { return b }\n"
    files['src/cycles/value-b.ts'] =
      "import { a } from './value-a'\nexport function b() { return a }\n"
    files['src/cycles/type-a.ts'] =
      "import type { B } from './type-b'\nexport type A = { other?: B }\n"
    files['src/cycles/type-b.ts'] =
      "import type { A } from './type-a'\nexport type B = { other?: A }\n"
    files['src/cycles/mixed-a.ts'] =
      "import type { B } from './mixed-b'\nexport type A = B\nexport const value = 1\n"
    files['src/cycles/mixed-b.ts'] =
      "import { value } from './mixed-a'\nexport type B = { value: number }\nexport const used = value\n"

    for (const [file, contents] of Object.entries(files)) {
      await mkdir(dirname(join(web, file)), { recursive: true })
      await writeFile(join(web, file), contents)
    }

    async function cruise(outputType, entry = 'src') {
      const args = [
        depcruise,
        '--config',
        '.dependency-cruiser.mjs',
        '--output-type',
        outputType,
        entry
      ]

      try {
        const { stdout } = await run(process.execPath, args, { cwd: web })

        return { stdout, exitCode: 0 }
      } catch (error) {
        if (Number.isInteger(error.code) && error.code > 0 && error.stdout) {
          return { stdout: error.stdout, exitCode: error.code }
        }

        throw error
      }
    }

    const report = JSON.parse((await cruise('json')).stdout)
    const { stdout: text, exitCode } = await cruise('err-long', 'src/app/page-inner.ts')

    const { stdout: layerText, exitCode: layerExitCode } = await cruise(
      'err-long',
      'src/shared/ui/upper.ts'
    )

    const { stdout: cycleText, exitCode: cycleExitCode } = await cruise(
      'err-long',
      'src/cycles/value-a.ts'
    )

    return {
      report,
      text,
      exitCode,
      layerText,
      layerExitCode,
      cycleText,
      cycleExitCode
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const { report, text, exitCode, layerText, layerExitCode, cycleText, cycleExitCode } =
  await cruiseSamples()

for (const [file, source, ruleName] of layerRejected) {
  test(`dependency-cruiser: ${file}에서 ${source} import를 거부한다`, () => {
    assert.deepEqual(
      report.summary.violations.filter(({ from }) => from === file).map(({ rule }) => rule),
      [{ name: ruleName, severity: 'error' }]
    )
  })
}
for (const [file, source] of [...aliasAllowed, ...layerAllowed]) {
  test(`dependency-cruiser: ${file}에서 ${source} import를 허용한다`, () => {
    assert.deepEqual(
      report.summary.violations.filter(({ from }) => from === file),
      []
    )
    const module = report.modules.find(({ source: path }) => path === file)
    assert.equal(module.dependencies.length, 1)
    assert.equal(module.dependencies[0].couldNotResolve, false)
  })
}

for (const [file, source, expected] of aliasAllowed) {
  test(`dependency-cruiser: ${source}는 ${expected}로 풀린다`, () => {
    const module = report.modules.find(({ source: path }) => path === file)
    assert.equal(module.dependencies[0].resolved, expected)
    assert.equal(module.dependencies[0].couldNotResolve, false)
  })
}

test('dependency-cruiser: 화면 안쪽 파일 import는 실패하고 화면 index.ts로 가져오라고 알린다', () => {
  assert.ok(exitCode > 0)
  assert.ok(
    text.includes('슬라이스 밖에서는 #pages/<슬라이스>처럼 그 슬라이스의 index.ts로 import한다.'),
    text
  )
})

test('dependency-cruiser: 위 계층 import는 실패하고 아래 계층만 import하라고 알린다', () => {
  assert.ok(layerExitCode > 0)
  assert.ok(layerText.includes('계층은 자기보다 아래 계층만 import한다.'), layerText)
})

test('dependency-cruiser: value import 순환은 실패하고 type-only 경로가 낀 순환은 허용한다', () => {
  const cycles = report.summary.violations.filter(({ rule }) => rule.name === 'no-circular')
  const members = new Set(cycles.flatMap(({ cycle }) => cycle.map(({ name }) => name)))
  assert.deepEqual(members, new Set(['src/cycles/value-a.ts', 'src/cycles/value-b.ts']))
  assert.ok(cycleExitCode > 0)
  assert.ok(cycleText.includes('error no-circular'), cycleText)

  for (const file of ['type-a', 'type-b', 'mixed-a', 'mixed-b']) {
    const module = report.modules.find(({ source }) => source === `src/cycles/${file}.ts`)
    assert.equal(module.dependencies[0].couldNotResolve, false)
  }
})
