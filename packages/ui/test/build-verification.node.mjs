import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const verifyScript = fileURLToPath(new URL('../scripts/verify-build.mjs', import.meta.url))
const indexSource = `import { Dialog } from "@base-ui/react/dialog";\nimport React from "react";\nimport { jsx } from "react/jsx-runtime";\nexport { Dialog, React, jsx };\n`
const libraryFiles = ['index.js']
const themeStyles = ':root{--color-canvas:light-dark(#fff,#151517)}'
const foundationStyles =
  'body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}'
const appFontStyles =
  "body{font-family:'IBM Plex Sans KR',system-ui,'Apple SD Gothic Neo',sans-serif}"

async function createLibraryFixture(context) {
  const output = await mkdtemp(join(tmpdir(), 'dfragon-ui-build-'))
  context.after(() => rm(output, { recursive: true, force: true }))
  await mkdir(join(output, 'notices'))
  await writeFile(join(output, 'notices/bundle-modules.json'), '[]')
  await writeFile(join(output, 'notices/bundle-files.json'), JSON.stringify(libraryFiles))
  await writeFile(join(output, 'index.js'), indexSource)
  await writeFile(join(output, 'index.d.ts'), 'export declare const Button: unknown;\n')

  return output
}

function inspect(output, mode = 'library') {
  const result = spawnSync(process.execPath, [verifyScript, mode, output], {
    encoding: 'utf8',
    timeout: 10_000
  })
  assert.ifError(result.error)

  return result
}

async function createConsumerFixture(context, styles) {
  const output = await createLibraryFixture(context)
  const graph = [
    { name: 'react', version: '19.3.0', modules: ['index.js'] },
    { name: 'react-dom', version: '19.3.0', modules: ['index.js'] },
    { name: '@base-ui/react', version: '1.9.0', modules: ['esm/index.js'] }
  ]
  await writeFile(join(output, 'notices/bundle-modules.json'), JSON.stringify(graph))
  await writeFile(join(output, 'notices/THIRD-PARTY.txt'), 'MIT License fixture\n')
  await writeFile(join(output, 'styles.css'), `${themeStyles}${styles}`)

  return output
}

test('Base UI 사본 하나와 theme.css, 공용 글꼴 한 번이 있는 소비자 빌드를 허용한다', async (context) => {
  const output = await createConsumerFixture(context, foundationStyles)
  const result = inspect(output, 'consumer')
  assert.equal(result.status, 0, result.stderr)
})

test('Base UI가 번들에 없어도 소비자 빌드를 허용한다', async (context) => {
  const output = await createConsumerFixture(context, foundationStyles)
  const graph = [
    { name: 'react', version: '19.3.0', modules: ['index.js'] },
    { name: 'react-dom', version: '19.3.0', modules: ['index.js'] }
  ]
  await writeFile(join(output, 'notices/bundle-modules.json'), JSON.stringify(graph))
  const result = inspect(output, 'consumer')
  assert.equal(result.status, 0, result.stderr)
})

test('Base UI 사본이 둘 번들되면 소비자 빌드 검사에 실패한다', async (context) => {
  const output = await createConsumerFixture(context, foundationStyles)
  const graph = JSON.parse(await readFile(join(output, 'notices/bundle-modules.json'), 'utf8'))
  graph.push({ name: '@base-ui/react', version: '1.8.0', modules: ['esm/index.js'] })
  await writeFile(join(output, 'notices/bundle-modules.json'), JSON.stringify(graph))
  const result = inspect(output, 'consumer')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Single bundled copy: @base-ui\/react/)
})

test('글꼴 변수와 앱 전역 글꼴 선언이 함께 있어도 공용 font stack은 한 번으로 센다', async (context) => {
  const output = await createConsumerFixture(
    context,
    `:root{--app-font-family:"Apple SD Gothic Neo",sans-serif}${foundationStyles}${appFontStyles}`
  )
  const result = inspect(output, 'consumer')
  assert.equal(result.status, 0, result.stderr)
})

test('minify가 따옴표를 지운 공용 font stack도 한 번으로 센다', async (context) => {
  const output = await createConsumerFixture(
    context,
    'body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Apple SD Gothic Neo,sans-serif}'
  )
  const result = inspect(output, 'consumer')
  assert.equal(result.status, 0, result.stderr)
})

for (const { name, styles } of [
  {
    name: '글꼴 변수와 앱 전역 글꼴 선언만 있고 공용 font stack이 없는 경우',
    styles: `:root{--app-font-family:"Apple SD Gothic Neo",sans-serif}${appFontStyles}`
  },
  {
    name: '공용 font stack이 두 번 출력된 경우',
    styles: `${foundationStyles}${foundationStyles.replace('body', '.duplicate')}`
  }
]) {
  test(`${name} 소비자 빌드 검사에 실패한다`, async (context) => {
    const output = await createConsumerFixture(context, styles)
    const result = inspect(output, 'consumer')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Shared base font stack once/)
  })
}

for (const { name, styles } of [
  { name: 'theme.css를 import하지 않은 경우', styles: foundationStyles },
  {
    name: 'theme.css가 두 번 출력된 경우',
    styles: `${themeStyles}${themeStyles}${foundationStyles}`
  }
]) {
  test(`${name} 소비자 빌드 검사에 실패한다`, async (context) => {
    const output = await createConsumerFixture(context, '')
    await writeFile(join(output, 'styles.css'), styles)
    const result = inspect(output, 'consumer')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Consumer must import @dfragon\/design\/theme\.css once/)
  })
}

test('공개 ESM과 선언 파일 산출물을 허용한다', async (context) => {
  const output = await createLibraryFixture(context)
  const result = inspect(output)
  assert.equal(result.status, 0, result.stderr)
})

for (const file of ['index.js', 'index.d.ts']) {
  test(`공개 산출물 ${file}이 누락되면 실패한다`, async (context) => {
    const output = await createLibraryFixture(context)
    await rm(join(output, file))
    if (file.endsWith('.js')) {
      const remaining = libraryFiles.filter((entry) => entry !== file)
      await writeFile(join(output, 'notices/bundle-files.json'), JSON.stringify(remaining))
    }
    const result = inspect(output)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Public export artifact/)
    assert.match(result.stderr, new RegExp(file.replaceAll('.', '\\.')))
  })
}

for (const { name, file, source, failure } of [
  {
    name: '선언에 pnpm 내부 경로가 남은 경우',
    file: 'index.d.ts',
    source: 'export { Button } from "../node_modules/.pnpm/react/index";\n',
    failure: /Portable browser declaration: index\.d\.ts/
  },
  {
    name: '선언이 node: 접두사 없이 Node builtin을 가져오는 경우',
    file: 'index.d.ts',
    source: 'export type { ReadStream } from "fs";\n',
    failure: /Portable browser declaration: index\.d\.ts/
  },
  {
    name: '선언이 import type 표현식으로 Node builtin을 참조하는 경우',
    file: 'index.d.ts',
    source: 'export type NodeStream = import("fs").ReadStream;\n',
    failure: /Portable browser declaration: index\.d\.ts/
  },
  {
    name: 'library JS가 소비자 소유 CSS를 가져오는 경우',
    file: 'index.js',
    source: `${indexSource}import '@dfragon/design/components.css';\n`,
    failure: /Library must not import CSS/
  },
  {
    name: 'library JS가 SEED runtime을 가져오는 경우',
    file: 'index.js',
    source: `${indexSource}import { ActionButton } from '@seed-design/react';\nexport { ActionButton };\n`,
    failure: /Library must not import SEED/
  },
  {
    name: 'library JS가 SEED 아이콘을 가져오는 경우',
    file: 'index.js',
    source: `${indexSource}import '@karrotmarket/react-monochrome-icon';\n`,
    failure: /Library must not import SEED/
  },
  {
    name: 'index.js가 Base UI를 external로 가져오지 않는 경우',
    file: 'index.js',
    source: indexSource
      .replace('import { Dialog } from "@base-ui/react/dialog";\n', '')
      .replace('Dialog, ', ''),
    failure: /External import: @base-ui\/react/
  }
]) {
  test(`${name} 빌드 경계 검사에 실패한다`, async (context) => {
    const output = await createLibraryFixture(context)
    await writeFile(join(output, file), source)
    const result = inspect(output)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, failure)
  })
}
