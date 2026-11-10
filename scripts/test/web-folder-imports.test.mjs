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
  ['components/a.ts', '../pages/a/APage', 'pages/'],
  ['components/nested/b.ts', '../../pages/a/util', 'pages/'],
  ['hooks/a.ts', '../pages/a/APage', 'pages/'],
  ['hooks/index.ts', '../pages', 'pages/'],
  ['host/a.ts', '../pages/a/APage', 'pages/'],
  ['host/nested/b.ts', '../../components/Shared', 'components/'],
  ['host/nested/c.ts', '../../hooks/useShared', 'hooks/'],
  ['host/index-import.ts', '../components', 'components/'],
  ['host/alias.ts', '#ui/components/Thing', 'components/'],
  ['hooks/alias.ts', '#pages/a/APage', 'pages/'],
  ['host/direct-alias.ts', '#components/Thing', 'components/'],
  ['core/a.ts', 'react', 'UI 폴더'],
  ['core/b.ts', '../components/Shared', 'UI 폴더']
]
const allowedImports = [
  ['components/allowed.ts', '../hooks/useShared'],
  ['hooks/allowed.ts', '../components/Shared'],
  ['host/allowed.ts', '#core/search/search'],
  ['host/package.ts', '@dfragon/ui/components/Thing'],
  ['host/package-index.ts', '@dfragon/ui/hooks'],
  ['core/allowed.ts', './search/search']
]

function importing(source) {
  return `import { value } from '${source}'\nexport const used = value\n`
}

function samples(cases) {
  return Object.fromEntries(cases.map(([file, source]) => [`${src}/${file}`, importing(source)]))
}

const rejected = await lintSamples(samples(rejectedImports))
const allowed = await lintSamples(samples(allowedImports))

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
  ['src/pages/a/relative.ts', '../b/hooks/useThing'],
  ['src/pages/a/via-root.ts', '../../pages/b/hooks/useThing'],
  ['src/pages/a/explicit.ts', '../b/hooks/useThing.ts'],
  ['src/pages/a/ts-page.ts', '../b/OtherPage'],
  ['src/pages/a/top-level-util.tsx', '../b/util'],
  ['src/pages/a/nested-page.ts', '../b/components/NestedPage.tsx'],
  ['src/pages/a/index-import.ts', '../b'],
  ['src/pages/a/one/two/three/four/deep.ts', '../../../../../b/hooks/useThing']
]
const screenAllowed = [
  ['src/pages/a/same.ts', './hooks/useThing'],
  ['src/pages/a/one/same.ts', '../hooks/useThing'],
  ['src/pages/a/shared.ts', '../../hooks/useShared'],
  ['src/pages/a/page.ts', '../b/BPage'],
  ['src/pages/a/page-tsx.ts', '../b/BPage.tsx'],
  ['src/pages/a/screen.ts', '../b/BScreen'],
  ['src/pages/a/screen-tsx.ts', '../b/BScreen.tsx'],
  ['src/pages/a/core.ts', '#core/search/search']
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
    for (const file of ['.dependency-cruiser.mjs', 'tsconfig.app.json', 'package.json']) {
      await cp(join(root, 'apps/web', file), join(web, file))
    }

    const files = Object.fromEntries(
      [...screenRejected, ...screenAllowed].map(([file, source]) => [file, importing(source)])
    )
    for (const file of [
      'src/pages/a/hooks/useThing.ts',
      'src/pages/b/hooks/useThing.ts',
      'src/pages/b/components/NestedPage.tsx',
      'src/pages/b/OtherPage.ts',
      'src/pages/b/util.tsx',
      'src/pages/b/index.ts',
      'src/pages/b/BPage.tsx',
      'src/pages/b/BScreen.tsx',
      'src/hooks/useShared.ts',
      'src/core/search/search.ts'
    ]) {
      files[file] = 'export const value = 1\n'
    }

    for (const [file, contents] of Object.entries(files)) {
      await mkdir(dirname(join(web, file)), { recursive: true })
      await writeFile(join(web, file), contents)
    }

    async function cruise(outputType) {
      const args = [
        depcruise,
        '--config',
        '.dependency-cruiser.mjs',
        '--output-type',
        outputType,
        'src'
      ]
      try {
        const { stdout } = await run(process.execPath, args, { cwd: web })

        return stdout
      } catch (error) {
        if (Number.isInteger(error.code) && error.code > 0 && error.stdout) {
          return error.stdout
        }
        throw error
      }
    }

    const report = JSON.parse(await cruise('json'))

    return { report, text: await cruise('err-long') }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const { report, text } = await cruiseSamples()
for (const [file, source] of screenRejected) {
  test(`dependency-cruiser: ${file}에서 ${source} import를 거부한다`, () => {
    assert.deepEqual(
      report.summary.violations.filter(({ from }) => from === file).map(({ rule }) => rule.name),
      ['screen-folder-imports']
    )
  })
}
for (const [file, source] of screenAllowed) {
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

test('dependency-cruiser: #core alias를 실제 소스로 해석한다', () => {
  const module = report.modules.find(({ source }) => source === 'src/pages/a/core.ts')
  assert.equal(module.dependencies[0].resolved, 'src/core/search/search.ts')
})

test('dependency-cruiser: 메시지는 공용 코드의 위치를 알린다', () => {
  assert.ok(text.includes('components/나 hooks/'), text)
})
