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
  ['core/search/parent.ts', '../character/character', '#<폴더>/...'],
  ['components/parent.ts', '../hooks/useShared', '#<폴더>/...'],
  ['host/parent.ts', '../core/search', '#<폴더>/...'],
  ['core/component-alias.ts', '#components/Shared', 'UI 폴더'],
  ['core/hook-alias.ts', '#hooks/useShared', 'UI 폴더'],
  ['core/page-alias.ts', '#pages/a', 'UI 폴더'],
  ['core/host-alias.ts', '#host/client-host', 'UI 폴더'],
  ['core/app-alias.ts', '#app/router', 'UI 폴더'],
  ['core/widget-alias.ts', '#widgets/global-bar', 'UI 폴더'],
  ['core/shared-ui-alias.ts', '#shared/ui/ListBox', 'UI 폴더'],
  ['core/feature-alias.ts', '#features/favorite', 'UI 폴더'],
  ['core/animation-alias.ts', '#shared/lib/animations/gsap-motion', 'UI 폴더'],
  ['components/a.ts', '#pages/a/APage', 'pages/'],
  ['components/nested/b.ts', '#pages/a/util', 'pages/'],
  ['hooks/a.ts', '#pages/a/APage', 'pages/'],
  ['hooks/index.ts', '#pages', 'pages/'],
  ['host/a.ts', '#pages/a/APage', 'pages/'],
  ['host/nested/b.ts', '#components/Shared', 'components/'],
  ['host/nested/c.ts', '#hooks/useShared', 'hooks/'],
  ['host/index-import.ts', '#components', 'components/'],
  ['host/alias.ts', '#ui/components/Thing', 'components/'],
  ['hooks/alias.ts', '#pages/a/APage', 'pages/'],
  ['host/direct-alias.ts', '#components/Thing', 'components/'],
  ['core/a.ts', 'react', 'UI 폴더'],
  ['core/b.ts', '#components/Shared', 'UI 폴더']
]
const allowedImports = [
  ['pages/a/same.ts', './local'],
  ['components/allowed.ts', '#hooks/useShared'],
  ['hooks/allowed.ts', '#components/Shared'],
  ['host/allowed.ts', '#core/search'],
  ['host/package.ts', '@dfragon/ui/components/Thing'],
  ['host/package-index.ts', '@dfragon/ui/hooks'],
  ['core/allowed.ts', './search/search']
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

const screenRejected = [
  ['src/pages/a/relative-screen-boundary.ts', '../b/hooks/useThing', 'screen-folder-imports'],
  ['src/pages/a/alias-screen-boundary.ts', '#pages/b/hooks/useThing', 'screen-folder-imports'],
  ['src/pages/a/explicit.ts', '#pages/b/hooks/useThing.ts', 'screen-folder-imports'],
  ['src/pages/a/ts-page.ts', '#pages/b/OtherPage', 'screen-folder-imports'],
  ['src/pages/a/top-level-util.tsx', '#pages/b/util', 'screen-folder-imports'],
  ['src/pages/a/nested-page.ts', '#pages/b/components/NestedPage.tsx', 'screen-folder-imports'],
  ['src/pages/a/page.ts', '#pages/b/BPage', 'screen-folder-imports'],
  ['src/pages/a/page-tsx.ts', '#pages/b/BPage.tsx', 'screen-folder-imports'],
  ['src/pages/a/screen.ts', '#pages/b/BScreen', 'screen-folder-imports'],
  ['src/pages/a/screen-tsx.ts', '#pages/b/BScreen.tsx', 'screen-folder-imports'],
  ['src/WebApp.ts', './pages/rankings/RankingsScreen', 'screen-folder-imports-outside-pages'],
  ['src/pages/router.ts', './rankings/RankingsScreen', 'screen-folder-imports-outside-pages'],
  ['src/WebApp.test.ts', './pages/b/hooks/useThing', 'screen-folder-imports-outside-pages'],
  ['src/testing/story.ts', '#pages/b/BPage.tsx', 'screen-folder-imports-outside-pages'],
  ['src/shared.ts', '#pages/b/util', 'screen-folder-imports-outside-pages']
]

const screenAllowed = [
  ['src/pages/a/same.ts', './hooks/useThing'],
  ['src/pages/a/one/same.ts', '#pages/a/hooks/useThing'],
  ['src/pages/b/same-page.ts', './BPage'],
  ['src/pages/a/shared.ts', '#hooks/useShared'],
  ['src/router.ts', '#pages/rankings'],
  ['src/router.test.ts', '#pages/b'],
  ['src/pages/a/core.ts', '#core/search']
]

const coreRejected = [
  ['src/pages/a/core-detail.ts', '#core/character/character-detail-view'],
  ['src/lib/core-relative.ts', '#core/character/character-detail-view'],
  ['src/testing/core-nested.ts', '#core/character/nested/helper'],
  ['src/core-boundary.test.ts', './core/character/character-detail-view']
]

const aliasAllowed = [
  ['src/pages/a/asset.ts', '#shared/assets/logo.png', 'src/shared/assets/logo.png'],
  ['src/pages/a/component.ts', '#components/Shared', 'src/components/Shared.tsx'],
  ['src/pages/a/shared-ui.ts', '#shared/ui/ListBox', 'src/shared/ui/ListBox.tsx'],
  ['src/pages/a/hook.ts', '#hooks/useShared', 'src/hooks/useShared.ts'],
  ['src/pages/a/host.ts', '#host/client-host', 'src/host/client-host.tsx'],
  ['src/pages/a/lib.ts', '#lib/shared', 'src/lib/shared.ts'],
  ['src/pages/a/testing.ts', '#testing/fixture', 'src/testing/fixture.tsx'],
  ['src/app/other-screen.ts', '#pages/b', 'src/pages/b/index.ts'],
  ['src/pages/a/same-screen.ts', '#pages/a/hooks/useThing', 'src/pages/a/hooks/useThing.ts']
]

const coreAllowed = [
  ['src/pages/a/core-character.ts', '#core/character'],
  ['src/pages/a/core-root.ts', '#core/root-file'],
  ['src/core/character/same.ts', './character-detail-view'],
  ['src/core/search/other-domain.ts', '#core/character/character-detail-view'],
  ['src/core/search/other-alias.ts', '#core/character/character-detail-view'],
  ['src/pages/a/core-image.ts', '#core/capture/raid/heading.png']
]

const layerRejected = [
  ['src/shared/ui/upper.ts', '#entities/character', 'layer-imports'],
  ['src/entities/character/upper.ts', '#features/favorite', 'layer-imports'],
  ['src/features/favorite/upper.ts', '#widgets/global-bar', 'layer-imports'],
  ['src/widgets/global-bar/upper.ts', '#pages/b', 'layer-imports'],
  ['src/pages/a/app.ts', '#app/router', 'layer-imports'],
  ['src/pages/a/index-import.ts', '#pages/b', 'slice-imports'],
  ['src/pages/stats/unlisted.ts', '#pages/b', 'slice-imports'],
  ['src/widgets/global-bar/other-slice.ts', '#widgets/site-footer', 'slice-imports'],
  ['src/features/favorite/other-slice.ts', '#features/color-mode', 'slice-imports'],
  ['src/entities/character/other-slice.ts', '#entities/ranking', 'slice-imports'],
  ['src/entities/character/other-x.ts', '#entities/ranking/@x/guild', 'slice-imports'],
  ['src/pages/a/feature-inner.ts', '#features/favorite/ui/FavoriteToggle', 'slice-index'],
  ['src/components/entity-inner.ts', '#entities/character/model/character', 'slice-index'],
  ['src/shared/lib/legacy-component.ts', '#components/Shared', 'shared-legacy-imports'],
  ['src/shared/ui/legacy-core.ts', '#core/search', 'shared-legacy-imports'],
  ['src/shared/config/legacy-hook.ts', '#hooks/useShared', 'shared-legacy-imports'],
  ['src/components/page.ts', '#pages/b', 'legacy-layer-imports'],
  ['src/core/app.ts', '#app/router', 'legacy-layer-imports'],
  ['src/core/character/search.ts', '#core/search/search', 'character-feature-imports'],
  ['src/core/character/search-index.ts', '#core/search', 'character-feature-imports'],
  [
    'src/core/character/capture-type.ts',
    '#core/capture/cards-types',
    'character-feature-imports',
    "import type { Value } from '#core/capture/cards-types'\nexport type Used = Value\n"
  ],
  ['src/core/character/ocr.ts', '../ocr/ocr', 'character-feature-imports'],
  ['src/core/api/http.ts', '#core/search/search', 'api-error-imports'],
  ['src/core/api/api-response.ts', '#core/search', 'api-error-imports']
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
  ['src/shared/ui/segment.ts', '#shared/lib/time-format'],
  ['src/entities/character/legacy.ts', '#core/search'],
  ['src/components/shared-ui.ts', '#shared/ui/ListBox'],
  ['src/pages/home/rankings.ts', '#pages/rankings'],
  ['src/pages/stats/rankings.ts', '#pages/rankings'],
  ['src/core/character/api-error.ts', '#core/api/http'],
  ['src/core/capture/character.ts', '#core/character/character-detail-view'],
  ['src/core/search/api-error.ts', '#core/api/http']
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
      [
        ...screenRejected,
        ...screenAllowed,
        ...coreRejected,
        ...coreAllowed,
        ...aliasAllowed,
        ...layerRejected,
        ...layerAllowed
      ].map(([file, source, , code]) => [file, code ?? importing(source)])
    )

    for (const file of [
      'src/shared/assets/logo.png',
      'src/shared/ui/ListBox.tsx',
      'src/shared/lib/time-format.ts',
      'src/components/Shared.tsx',
      'src/lib/shared.ts',
      'src/host/client-host.tsx',
      'src/testing/fixture.tsx',
      'src/pages/a/hooks/useThing.ts',
      'src/pages/b/hooks/useThing.ts',
      'src/pages/b/components/NestedPage.tsx',
      'src/pages/b/OtherPage.ts',
      'src/pages/b/util.tsx',
      'src/pages/b/BPage.tsx',
      'src/pages/b/BScreen.tsx',
      'src/pages/rankings/RankingsScreen.tsx',
      'src/hooks/useShared.ts',
      'src/core/search/search.ts',
      'src/core/capture/cards-types.ts',
      'src/core/ocr/ocr.ts',
      'src/core/character/character-detail-view.ts',
      'src/core/character/nested/helper.ts',
      'src/widgets/global-bar/index.ts',
      'src/widgets/site-footer/index.ts',
      'src/features/favorite/index.ts',
      'src/features/favorite/ui/FavoriteToggle.tsx',
      'src/features/favorite/model/store.ts',
      'src/features/color-mode/index.ts',
      'src/entities/character/index.ts',
      'src/entities/character/@x/guild.ts',
      'src/entities/character/model/character.ts',
      'src/entities/ranking/index.ts',
      'src/entities/ranking/@x/guild.ts',
      'src/core/capture/raid/heading.png',
      'src/core/root-file.ts'
    ]) {
      files[file] = 'export const value = 1\n'
    }

    files['src/pages/b/index.ts'] = "export { value } from './BPage'\n"
    files['src/pages/rankings/index.ts'] = "export { value } from './RankingsScreen'\n"
    files['src/core/search/index.ts'] = "export { value } from './search'\n"
    files['src/core/character/index.ts'] = "export { value } from './character-detail-view'\n"
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
    const { stdout: text, exitCode } = await cruise('err-long', 'src/WebApp.ts')
    const { stdout: coreText, exitCode: coreExitCode } = await cruise(
      'err-long',
      'src/pages/a/core-detail.ts'
    )

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
      coreText,
      coreExitCode,
      layerText,
      layerExitCode,
      cycleText,
      cycleExitCode
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const {
  report,
  text,
  exitCode,
  coreText,
  coreExitCode,
  layerText,
  layerExitCode,
  cycleText,
  cycleExitCode
} = await cruiseSamples()

for (const [file, source, ruleName] of [...screenRejected, ...layerRejected]) {
  test(`dependency-cruiser: ${file}에서 ${source} import를 거부한다`, () => {
    assert.deepEqual(
      report.summary.violations.filter(({ from }) => from === file).map(({ rule }) => rule),
      [{ name: ruleName, severity: 'error' }]
    )
  })
}
for (const [file, source] of [...screenAllowed, ...coreAllowed, ...aliasAllowed, ...layerAllowed]) {
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

test('dependency-cruiser: #core alias를 실제 소스로 해석한다', () => {
  const module = report.modules.find(({ source }) => source === 'src/pages/a/core.ts')
  assert.equal(module.dependencies[0].resolved, 'src/core/search/index.ts')
})

test('dependency-cruiser: 화면 파일 직접 import는 실패하고 폴더 경로와 공용 코드 위치를 알린다', () => {
  assert.ok(exitCode > 0)
  assert.ok(text.includes('#pages/<화면>(예: #pages/rankings)처럼 폴더 경로로 import한다.'), text)
  assert.ok(text.includes('components/나 hooks/'), text)
})

test('dependency-cruiser: 위 계층 import는 실패하고 아래 계층만 import하라고 알린다', () => {
  assert.ok(layerExitCode > 0)
  assert.ok(layerText.includes('계층은 자기보다 아래 계층만 import한다.'), layerText)
})

for (const [file, source] of coreRejected) {
  test(`dependency-cruiser: core 밖 ${file}에서 ${source} 직접 import를 거부한다`, () => {
    assert.deepEqual(
      report.summary.violations.filter(({ from }) => from === file).map(({ rule }) => rule),
      [{ name: 'core-folder-index', severity: 'error' }]
    )
  })
}

test('dependency-cruiser: core 직접 import는 실패하고 #core/character 경로를 안내한다', () => {
  assert.ok(coreExitCode > 0)
  assert.ok(coreText.includes('#core/<도메인>(예: #core/character)으로 가져온다.'), coreText)
})

test('dependency-cruiser: #core/character는 도메인 index.ts로 풀린다', () => {
  const module = report.modules.find(({ source }) => source === 'src/pages/a/core-character.ts')
  assert.equal(module.dependencies[0].resolved, 'src/core/character/index.ts')
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
