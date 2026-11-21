import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'
import { lintSamples } from './fixtures/biome-lint.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const internal = join(root, 'apps/internal')
const aliases = [
  ['#ops-api/ops-client', 'api/ops-client.ts'],
  ['#ops-components/JobTable', 'components/JobTable.tsx'],
  ['#ops-testing/fake-ops-api', 'testing/fake-ops-api.ts'],
  ['#ops-app/format', 'format.ts'],
  ['#ops-app/ops-queries', 'ops-queries.ts'],
  ['#ops-app/run-args', 'run-args.ts']
]

test('Biome: 운영 화면의 상위 상대 경로를 거부하고 같은 폴더와 alias를 허용한다', async () => {
  const rejected = {
    'apps/internal/src/components/value.ts':
      "import { value } from '../format'\nexport { value }\n",
    'apps/internal/src/components/type.ts':
      "import type { Value } from '../api/ops-schemas'\nexport type Used = Value\n",
    'apps/internal/src/components/nested/dynamic.ts':
      "export const used = import('../../format')\n",
    'apps/internal/src/components/export.ts': "export { value } from '../format'\n"
  }

  const aliasSamples = Object.fromEntries(
    aliases.map(([alias], index) => [
      `apps/internal/src/components/alias-${index}.ts`,
      `export { value } from '${alias}'\n`
    ])
  )

  const allowed = {
    'apps/internal/src/components/local.ts': "export { value } from './local-value'\n",
    'apps/internal/vite.config.ts': "export { value } from '../shared'\n",
    ...aliasSamples
  }

  const diagnostics = await lintSamples({ ...rejected, ...allowed })

  for (const file of Object.keys(rejected)) {
    const errors = diagnostics.get(file)
    assert.equal(errors.length, 1, JSON.stringify(errors))
    assert.equal(errors[0].category, 'lint/style/noRestrictedImports')
    assert.ok(errors[0].message.includes('alias로 가져온다'), errors[0].message)
  }

  for (const file of Object.keys(allowed)) {
    assert.deepEqual(diagnostics.get(file), [], file)
  }
})

test('TypeScript: 운영 화면 alias를 원래 소스 파일로 해석한다', () => {
  const configFile = ts.readConfigFile(join(internal, 'tsconfig.app.json'), ts.sys.readFile)
  assert.equal(configFile.error, undefined)
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, internal)
  assert.deepEqual(config.errors, [])

  for (const [alias, source] of aliases) {
    const result = ts.resolveModuleName(
      alias,
      join(internal, 'src/components/consumer.ts'),
      config.options,
      ts.sys
    )
    assert.equal(result.resolvedModule?.resolvedFileName, join(internal, 'src', source), alias)
  }
})

test('Vite, Vitest, Storybook: 운영 화면 alias와 웹 alias를 충돌 없이 해석한다', async () => {
  const require = createRequire(join(internal, 'package.json'))
  const viteEntry = require.resolve('vite')
  const viteUrl = pathToFileURL(viteEntry).href
  const { createServer } = await import(viteUrl)
  const { default: storybook } = await import('../../apps/storybook/.storybook/main.ts')
  const storyConfig = await storybook.viteFinal({ plugins: [] })
  const viteConfigFile = join(internal, 'vite.config.ts')
  const vitestConfigFile = join(internal, 'vitest.config.ts')

  for (const config of [
    { configFile: viteConfigFile },
    { configFile: vitestConfigFile },
    { ...storyConfig, configFile: false }
  ]) {
    const server = await createServer({
      ...config,
      root: internal,
      server: { middlewareMode: true, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] }
    })

    try {
      const importer = join(internal, 'src/components/consumer.ts')

      for (const [alias, source] of aliases) {
        const result = await server.pluginContainer.resolveId(alias, importer)
        assert.equal(result?.id, join(internal, 'src', source), alias)
      }

      if (config.configFile === false) {
        const result = await server.pluginContainer.resolveId(
          '#features/favorite-character',
          join(root, 'apps/web/src/app/router.tsx')
        )
        assert.equal(result?.id, join(root, 'apps/web/src/features/favorite-character/index.ts'))
      }
    } finally {
      await server.close()
    }
  }
})
