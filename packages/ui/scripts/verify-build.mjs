import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import { isBuiltin } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript-compiler-api'

function moduleSpecifiers(file, code) {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest)
  const specifiers = []
  function visit(node) {
    const isModuleDeclaration = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
    if (isModuleDeclaration && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    }

    const isImportType = ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
    if (isImportType && ts.isStringLiteral(node.argument.literal)) {
      specifiers.push(node.argument.literal.text)
    }

    const isDynamicImport =
      ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
    if (isDynamicImport && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  return specifiers
}

const [mode, outputPath] = process.argv.slice(2)
const isLibrary = mode === 'library'
const isConsumer = mode === 'consumer'
const isModeValid = isLibrary || isConsumer
assert.ok(isModeValid, 'Use library|consumer and an output directory')
const output = resolve(outputPath)
const uiRoot = fileURLToPath(new URL('../', import.meta.url))
const files = await readdir(output, { recursive: true })
if (isLibrary) {
  const manifest = JSON.parse(await readFile(resolve(uiRoot, 'package.json'), 'utf8'))
  for (const [entry, conditions] of Object.entries(manifest.exports)) {
    const isAsset = typeof conditions === 'string'
    if (isAsset) {
      await access(resolve(uiRoot, conditions)).catch(() => {
        assert.fail(`Public export file: ${entry} ${conditions}`)
      })
      continue
    }
    for (const condition of ['import', 'types']) {
      const target = conditions[condition]
      assert.ok(target.startsWith('./dist/'), `Public export target: ${entry} ${condition}`)
      const file = target.slice('./dist/'.length)
      assert.ok(files.includes(file), `Public export artifact: ${entry} ${condition} ${file}`)
    }
  }
}
const graph = JSON.parse(await readFile(resolve(output, 'notices/bundle-modules.json'), 'utf8'))
const javaScriptFiles = JSON.parse(
  await readFile(resolve(output, 'notices/bundle-files.json'), 'utf8')
)
const hasJavaScriptFiles = javaScriptFiles.length > 0
assert.ok(hasJavaScriptFiles, 'Generated JS bundle list must not be empty')
const cssFiles = files.filter((file) => {
  const isStylesheet = file.endsWith('.css')

  return isStylesheet
})

const NONPORTABLE_DECLARATION_PATTERN = /node:|NodeJS|\.pnpm/
const STYLESHEET_IMPORT_PATTERN = /\.css(?:$|\?)/
const THEME_DEFINITION_PATTERN = /--color-canvas\s*:/g
// @dfragon/design/base.css의 system font stack 첫머리로 센다. 앱 전역 글꼴 CSS의 대체 글꼴 목록은 세지 않는다.
const BASE_FONT_FAMILY_PATTERN =
  /(?:^|[;{])\s*font-family\s*:\s*-apple-system\s*,\s*BlinkMacSystemFont\s*,\s*['"]?Apple SD Gothic Neo/g

if (isLibrary) {
  assert.equal(graph.length, 0, 'Library must externalize all runtime dependencies')
  assert.equal(cssFiles.length, 0, 'Library must not emit CSS')
  const declarations = files.filter((file) => {
    const isDeclaration = file.endsWith('.d.ts')

    return isDeclaration
  })
  for (const declaration of declarations) {
    const types = await readFile(resolve(output, declaration), 'utf8')
    const hasNodeImport = moduleSpecifiers(declaration, types).some(isBuiltin)
    const hasPrivateOrNodeType = NONPORTABLE_DECLARATION_PATTERN.test(types) || hasNodeImport
    assert.equal(hasPrivateOrNodeType, false, `Portable browser declaration: ${declaration}`)
  }

  for (const file of javaScriptFiles) {
    const code = await readFile(resolve(output, file), 'utf8')
    for (const specifier of moduleSpecifiers(file, code)) {
      const isStylesheet = STYLESHEET_IMPORT_PATTERN.test(specifier)
      assert.equal(isStylesheet, false, `Library must not import CSS: ${file} ${specifier}`)
      // external로 남는 경우도 막는다.
      const isSeedPackage =
        specifier.startsWith('@seed-design/') || specifier.startsWith('@karrotmarket/')
      assert.equal(isSeedPackage, false, `Library must not import SEED: ${file} ${specifier}`)
    }
  }

  const index = await readFile(resolve(output, 'index.js'), 'utf8')
  const imports = moduleSpecifiers('index.js', index)
  for (const external of ['react', 'react/jsx-runtime']) {
    const hasExternalImport = imports.includes(external)
    assert.ok(hasExternalImport, `External import: ${external}`)
  }
  const hasBaseUiImport = imports.some((specifier) => {
    const isBaseUi = specifier === '@base-ui/react' || specifier.startsWith('@base-ui/react/')

    return isBaseUi
  })
  assert.ok(hasBaseUiImport, 'External import: @base-ui/react')
} else {
  function bundledCopies(name) {
    return graph.filter((dependency) => {
      const hasExpectedName = dependency.name === name

      return hasExpectedName
    })
  }
  const expectedVersions = {
    react: '19.3.0',
    'react-dom': '19.3.0'
  }
  for (const [name, version] of Object.entries(expectedVersions)) {
    const copies = bundledCopies(name)
    assert.equal(copies.length, 1, `Single bundled copy: ${name}`)
    assert.equal(copies[0].version, version, name)
  }
  // 화면이 공용 Component의 Base UI 부품을 쓰지 않으면 번들에 없을 수 있다.
  // 들어 있다면 사본은 하나여야 한다.
  const baseUiCopies = bundledCopies('@base-ui/react')
  assert.ok(baseUiCopies.length <= 1, 'Single bundled copy: @base-ui/react')
  assert.equal(cssFiles.length, 1, 'Consumer must emit one combined stylesheet')
  const styles = await readFile(resolve(output, cssFiles[0]), 'utf8')
  assert.equal(
    styles.match(THEME_DEFINITION_PATTERN)?.length,
    1,
    'Consumer must import @dfragon/design/theme.css once'
  )
  assert.equal(styles.match(BASE_FONT_FAMILY_PATTERN)?.length, 1, 'Shared base font stack once')
  const licenses = await readFile(resolve(output, 'notices/THIRD-PARTY.txt'), 'utf8')
  const hasMitLicense = licenses.includes('MIT License')
  assert.ok(hasMitLicense, 'Bundled dependency license text retained')
}

console.log(`${mode}: build output checks passed`)
