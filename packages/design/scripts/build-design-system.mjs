import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'tailwindcss'

const packageDirectory = fileURLToPath(new URL('../', import.meta.url))
const defaultOutputDirectory = join(packageDirectory, 'out')
const sourceDirectory = join(packageDirectory, 'design-system')
const previewDirectory = join(sourceDirectory, 'previews')
const componentDirectory = join(packageDirectory, 'components')

const SYSTEM_TITLE = 'DFragon 디자인 시스템'
const SYSTEM_NAMESPACE = 'DFragon'
const CANVAS_STYLESHEET_NAME = 'dfragon-design.css'
const COVER_NAME = 'Cover'

const COMMENT_PATTERN = /\/\*([\s\S]*?)\*\//y
const DECLARATION_PATTERN = /(--[A-Za-z0-9*-]+)\s*:/y
const VARIABLE_REFERENCE_PATTERN = /var\((--[A-Za-z0-9-]+)\)/g
const LIGHT_DARK_START = 'light-dark('
const CLASS_ATTRIBUTE_PATTERN = /class="([^"]*)"/g
const FONT_FACE_PATTERN = /@font-face\s*\{([^}]*)\}/g
const FONT_FAMILY_PATTERN = /font-family:\s*'([^']+)'/
const FONT_SOURCE_PATTERN = /url\('(\.\/fonts\/[^']+)'\)/
const FONT_WEIGHT_PATTERN = /font-weight:\s*([^;]+);/
const FONT_STYLE_PATTERN = /font-style:\s*([^;]+);/
const TEXT_PROPERTY_SEPARATOR = '--'
const BLANK_LINE_PATTERN = /^[ \t]*\n/
const WHITESPACE_PATTERN = /\s/
const WHITESPACE_RUN_PATTERN = /\s+/g
const SPACE_AFTER_OPENING_PATTERN = /\(\s/g
const SPACE_BEFORE_CLOSING_PATTERN = /\s\)/g
const CLASS_SEPARATOR_PATTERN = /\s+/

const TEXT_STYLE_PROPERTIES = {
  'line-height': 'lineHeight',
  'font-weight': 'fontWeight',
  'letter-spacing': 'letterSpacing'
}

// Tailwind CSS namespace마다 artifact의 토큰 family를 정한다. 여기 없는 이름은 artifact에서 빠지므로 빌드를 멈춘다.
const FAMILY_BY_PREFIX = [
  ['--gray-', 'color'],
  ['--color-', 'color'],
  ['--shadow-', 'shadow'],
  ['--gradient-', 'gradient'],
  ['--spacing', 'spacing'],
  ['--height-', 'size'],
  ['--container-', 'size'],
  ['--size-', 'size'],
  ['--radius-', 'radius'],
  ['--ease-', 'easing'],
  ['--default-transition-timing-function', 'easing'],
  ['--duration-', 'duration'],
  ['--default-transition-duration', 'duration'],
  ['--cycle', 'duration'],
  ['--beat', 'duration'],
  ['--animate-', 'duration'],
  ['--z-index-', 'zIndex'],
  ['--breakpoint-', 'breakpoint'],
  ['--tracking-', 'tracking'],
  ['--leading-', 'lineHeight'],
  ['--text-', 'text'],
  ['--font-weight-', 'fontWeight'],
  ['--font-', 'font']
]

// artifact가 section 이름만 key에서 따오는 family다. 값은 단일 CSS 값이어야 한다.
const PLAIN_FAMILIES = ['size', 'zIndex', 'breakpoint', 'fontWeight', 'tracking', 'lineHeight']
const LISTED_FAMILIES = [
  'color',
  'spacing',
  'radius',
  'shadow',
  'gradient',
  'easing',
  'duration',
  ...PLAIN_FAMILIES
]

function closingParenthesis(source, openIndex) {
  let depth = 0

  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '(') {
      depth += 1
    } else if (source[index] === ')') {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  throw new Error(`괄호가 닫히지 않음: ${source.slice(openIndex, openIndex + 40)}`)
}

function splitTopLevelComma(source) {
  let depth = 0

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '(') {
      depth += 1
    } else if (source[index] === ')') {
      depth -= 1
    } else if (source[index] === ',' && depth === 0) {
      return [source.slice(0, index).trim(), source.slice(index + 1).trim()]
    }
  }

  throw new Error(`light-dark()의 두 값을 나눌 수 없음: ${source}`)
}

function blockBody(css, opening) {
  const start = css.indexOf(opening)

  if (start === -1) {
    throw new Error(`theme.css에 ${opening} 블록이 없음`)
  }

  const bodyStart = start + opening.length
  const end = css.indexOf('\n}', bodyStart)

  return css.slice(bodyStart, end)
}

// 주석은 다음 주석이나 빈 줄까지 이어지는 선언의 쓰는 곳이다.
function declarationsOf(body) {
  const declarations = []
  let usage = null
  let index = 0

  while (index < body.length) {
    const character = body[index]

    if (character === '\n' && BLANK_LINE_PATTERN.test(body.slice(index + 1))) {
      usage = null
      index += 1
      continue
    }

    if (WHITESPACE_PATTERN.test(character)) {
      index += 1
      continue
    }

    COMMENT_PATTERN.lastIndex = index
    const comment = COMMENT_PATTERN.exec(body)

    if (comment) {
      usage = comment[1].trim()
      index = COMMENT_PATTERN.lastIndex
      continue
    }

    DECLARATION_PATTERN.lastIndex = index
    const declaration = DECLARATION_PATTERN.exec(body)

    if (!declaration) {
      throw new Error(`theme.css에서 읽을 수 없는 내용: ${body.slice(index, index + 40)}`)
    }

    let depth = 0
    let end = DECLARATION_PATTERN.lastIndex

    while (end < body.length && !(body[end] === ';' && depth === 0)) {
      if (body[end] === '(') {
        depth += 1
      } else if (body[end] === ')') {
        depth -= 1
      }

      end += 1
    }

    const value = body
      .slice(DECLARATION_PATTERN.lastIndex, end)
      .replace(WHITESPACE_RUN_PATTERN, ' ')
      .replace(SPACE_AFTER_OPENING_PATTERN, '(')
      .replace(SPACE_BEFORE_CLOSING_PATTERN, ')')
      .trim()

    declarations.push({ name: declaration[1], value, usage })
    index = end + 1
  }

  return declarations
}

export function readThemeTokens(themeCss) {
  const primitives = declarationsOf(blockBody(themeCss, ':root {'))
  const roles = declarationsOf(blockBody(themeCss, '@theme static {')).filter((declaration) => {
    const isWildcardReset = declaration.name.includes('*')

    return !isWildcardReset
  })

  return [...primitives, ...roles]
}

function pickTheme(value, theme) {
  let picked = value
  let start = picked.indexOf(LIGHT_DARK_START)

  while (start !== -1) {
    const argumentStart = start + LIGHT_DARK_START.length
    const end = closingParenthesis(picked, argumentStart - 1)
    const [light, dark] = splitTopLevelComma(picked.slice(argumentStart, end))
    const chosen = theme === 'light' ? light : dark
    picked = picked.slice(0, start) + chosen + picked.slice(end + 1)
    start = picked.indexOf(LIGHT_DARK_START)
  }

  return picked
}

function resolveForTheme(value, theme, rawValues, seen = new Set()) {
  return pickTheme(value, theme).replace(VARIABLE_REFERENCE_PATTERN, (_, name) => {
    if (seen.has(name) || !rawValues.has(name)) {
      throw new Error(`풀 수 없는 var(${name})`)
    }

    return resolveForTheme(rawValues.get(name), theme, rawValues, new Set([...seen, name]))
  })
}

function familyOf(name) {
  const entry = FAMILY_BY_PREFIX.find(([prefix]) => {
    const matches = name === prefix || name.startsWith(prefix)

    return matches
  })

  if (!entry) {
    throw new Error(`artifact family가 정해지지 않은 토큰: ${name}`)
  }

  return entry[1]
}

function themedValue(value, rawValues) {
  const light = resolveForTheme(value, 'light', rawValues)
  const dark = resolveForTheme(value, 'dark', rawValues)

  if (light === dark) {
    return light
  }

  return { light, dark }
}

function primitiveUsage(name, tokens) {
  const reference = `var(${name})`
  const users = []

  for (const token of tokens) {
    if (!token.value.includes(reference)) {
      continue
    }

    const themes = [
      pickTheme(token.value, 'light').includes(reference) && '라이트',
      pickTheme(token.value, 'dark').includes(reference) && '다크'
    ].filter(Boolean)

    users.push(`${token.name.slice(2)}(${themes.join(', ')})`)
  }

  if (users.length === 0) {
    return '원색 단계. 참조하는 역할 토큰이 없다.'
  }

  return `원색 단계. utility로 내보내지 않고 역할 토큰이 참조한다: ${users.join(', ')}`
}

export function tokensFromTheme(themeCss, fonts, meta) {
  const declarations = readThemeTokens(themeCss)
  const rawValues = new Map(
    declarations.map((declaration) => {
      return [declaration.name, declaration.value]
    })
  )
  const families = Object.fromEntries(
    LISTED_FAMILIES.map((family) => {
      return [family, []]
    })
  )
  const fontFamilies = {}
  const textStyles = new Map()

  for (const declaration of declarations) {
    const family = familyOf(declaration.name)
    const name = declaration.name.slice(2)

    if (family === 'font') {
      fontFamilies[name.slice('font-'.length)] = declaration.value
      continue
    }

    if (family === 'text') {
      const [styleName, property] = name.slice('text-'.length).split(TEXT_PROPERTY_SEPARATOR)
      const style = textStyles.get(styleName) ?? { name: styleName }

      if (property == null) {
        style.fontSize = declaration.value
        style.usage = declaration.usage ?? undefined
      } else if (TEXT_STYLE_PROPERTIES[property]) {
        style[TEXT_STYLE_PROPERTIES[property]] = declaration.value
      } else {
        throw new Error(`artifact에 둘 곳이 없는 글자 속성: ${declaration.name}`)
      }

      textStyles.set(styleName, style)
      continue
    }

    const isPrimitive = declaration.name.startsWith('--gray-')
    const usage = isPrimitive ? primitiveUsage(declaration.name, declarations) : declaration.usage
    let value = themedValue(declaration.value, rawValues)

    // 다크 값이 있는 그라데이션도 artifact의 다른 family는 테마별 값을 받지 않아 라이트 값만 둔다.
    if (family === 'gradient' && typeof value !== 'string') {
      value = value.light
    }

    const tokenUsage = usage ?? name

    families[family].push({ name, value, usage: tokenUsage })
  }

  const fontStackKeys = Object.keys(fontFamilies)
  const styles = [...textStyles.values()]
  const groups =
    textStyles.size === 0 ? [] : [{ name: '글자 단계', family: fontStackKeys[0], styles }]
  const plainSections = Object.fromEntries(
    PLAIN_FAMILIES.map((family) => {
      return [family, { tokens: families[family] }]
    })
  )

  return {
    name: SYSTEM_TITLE,
    version: 1,
    meta,
    color: {
      themes: [
        { id: 'light', name: '라이트' },
        { id: 'dark', name: '다크' }
      ],
      tokens: families.color
    },
    type: {
      fonts,
      families: fontFamilies,
      groups
    },
    spacing: { tokens: families.spacing },
    radius: { tokens: families.radius },
    shadow: { tokens: families.shadow },
    gradient: {
      note: '다크 값은 color-rarity-*-start, -end 토큰의 다크 값으로 그린다.',
      tokens: families.gradient
    },
    easing: { tokens: families.easing },
    duration: {
      note: 'prefers-reduced-motion: reduce에서는 duration-* 값이 0ms이고, animate-*는 쓰는 컴포넌트가 끈다.',
      tokens: families.duration
    },
    ...plainSections
  }
}

export function countTokens(tokens) {
  const listed = LISTED_FAMILIES.map((family) => {
    return tokens[family].tokens.length
  }).reduce((sum, count) => {
    return sum + count
  }, 0)
  const textProperties = tokens.type.groups
    .flatMap((group) => {
      return group.styles
    })
    .map((style) => {
      const properties = ['fontSize', ...Object.values(TEXT_STYLE_PROPERTIES)].filter((key) => {
        const isPresent = style[key] != null

        return isPresent
      })

      return properties.length
    })
    .reduce((sum, count) => {
      return sum + count
    }, 0)

  return listed + Object.keys(tokens.type.families).length + textProperties
}

export function readFontFaces(baseCss) {
  return [...baseCss.matchAll(FONT_FACE_PATTERN)].map(([, body]) => {
    const source = body.match(FONT_SOURCE_PATTERN)?.[1]

    if (source == null) {
      throw new Error(`base.css의 @font-face에서 ./fonts/ 파일을 찾지 못함: ${body}`)
    }

    const weight = body.match(FONT_WEIGHT_PATTERN)?.[1].trim() ?? '400'
    const style = body.match(FONT_STYLE_PATTERN)?.[1].trim() ?? 'normal'
    const family = body.match(FONT_FAMILY_PATTERN)[1]
    const file = `fonts/${basename(source)}`

    return {
      family,
      source,
      file,
      weight,
      style
    }
  })
}

function pascalCase(stem) {
  return stem
    .split('-')
    .map((part) => {
      return part[0].toUpperCase() + part.slice(1)
    })
    .join('')
}

async function listFiles(directory, extension) {
  try {
    const entries = await readdir(directory)

    return entries
      .filter((entry) => {
        const matches = entry.endsWith(extension)

        return matches
      })
      .sort()
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function readPreviews(componentStylesheets) {
  const previewFiles = await listFiles(previewDirectory, '.html')
  const previewStems = previewFiles.map((file) => {
    return file.slice(0, -'.html'.length)
  })
  const missing = componentStylesheets
    .map((file) => {
      return file.slice(0, -'.css'.length)
    })
    .filter((stem) => {
      const hasPreview = previewStems.includes(stem)

      return !hasPreview
    })

  if (missing.length > 0) {
    throw new Error(`preview가 없는 컴포넌트: ${missing.join(', ')}`)
  }

  return Promise.all(
    previewStems.map(async (stem) => {
      const html = await readFile(join(previewDirectory, `${stem}.html`), 'utf8')
      const name = stem === 'cover' ? COVER_NAME : pascalCase(stem)

      return { name, html }
    })
  )
}

function classCandidates(htmlFiles, colorTokens) {
  const candidates = new Set()

  for (const html of htmlFiles) {
    for (const [, classes] of html.matchAll(CLASS_ATTRIBUTE_PATTERN)) {
      for (const candidate of classes.split(CLASS_SEPARATOR_PATTERN).filter(Boolean)) {
        candidates.add(candidate)
      }
    }
  }

  // 캔버스 보드는 저장소에 없어 클래스를 읽을 수 없으므로 색 utility는 모두 낸다.
  for (const token of colorTokens) {
    if (!token.name.startsWith('color-')) {
      continue
    }

    const color = token.name.slice('color-'.length)

    for (const property of ['bg', 'text', 'border']) {
      candidates.add(`${property}-${color}`)
    }
  }

  return [...candidates]
}

function unwrapLayer(css, layer) {
  const opening = `@layer ${layer} {`
  const start = css.indexOf(opening)

  if (start === -1) {
    throw new Error(`컴파일한 CSS에 ${opening}이 없음`)
  }

  let depth = 0

  for (let index = start + opening.length - 1; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1
    } else if (css[index] === '}') {
      depth -= 1

      if (depth === 0) {
        return css.slice(0, start) + css.slice(start + opening.length, index) + css.slice(index + 1)
      }
    }
  }

  throw new Error(`${opening} 블록이 닫히지 않음`)
}

const require = createRequire(import.meta.url)

async function loadStylesheet(id, basedir) {
  const path = id.startsWith('.') ? join(basedir, id) : require.resolve(id, { paths: [basedir] })
  const base = dirname(path)
  const content = await readFile(path, 'utf8')

  return { path, base, content }
}

async function compileStylesheet(componentStylesheets, candidates) {
  const componentImports = componentStylesheets.map((file) => {
    return `@import './components/${file}' layer(components);`
  })
  const entry = [
    '@layer theme, base, components, utilities;',
    "@import 'tailwindcss/theme.css' layer(theme);",
    "@import './theme.css';",
    "@import './base.css' layer(base);",
    ...componentImports,
    "@import 'tailwindcss/utilities.css' layer(utilities);"
  ].join('\n')
  const compiler = await compile(entry, { base: packageDirectory, loadStylesheet })
  const compiled = compiler.build(candidates)

  // Design System artifact가 tokens.json으로 만든 tokens.css는 layer 밖에 있어 layer 안의 저장소 토큰을 덮는다.
  // 저장소 값이 이기도록 theme layer만 풀고, artifact와 캔버스가 쓰는 data-theme을 base.css의 color-scheme에 잇는다.

  return [
    unwrapLayer(compiled, 'theme'),
    ":root[data-theme='light'] { color-scheme: light; }",
    ":root[data-theme='dark'] { color-scheme: dark; }",
    ''
  ].join('\n')
}

async function replaceFontSources(css, fonts, sourceFor) {
  let replaced = css

  for (const font of fonts) {
    const target = `url('${font.source}')`

    if (!replaced.includes(target)) {
      throw new Error(`컴파일한 CSS에서 ${target}을 찾지 못함`)
    }

    replaced = replaced.replaceAll(target, `url('${await sourceFor(font)}')`)
  }

  return replaced
}

function sourceCommit() {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: packageDirectory,
    encoding: 'utf8'
  }).trim()
}

async function writeOutput(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

export async function buildDesignSystem({
  outputDirectory = defaultOutputDirectory,
  now = new Date()
} = {}) {
  const themeCss = await readFile(join(packageDirectory, 'theme.css'), 'utf8')
  const baseCss = await readFile(join(packageDirectory, 'base.css'), 'utf8')
  const fontFaces = readFontFaces(baseCss)
  const componentStylesheets = await listFiles(componentDirectory, '.css')
  const previews = await readPreviews(componentStylesheets)
  const ref = sourceCommit()
  const syncedAt = now.toISOString()
  const meta = {
    source: 'github',
    repo: 'dungeon-and-dragon/dfragon',
    ref,
    package: 'packages/design',
    paths: { tokens: ['theme.css'], fonts: ['base.css', 'fonts'], docs: ['design-system'] },
    synced: syncedAt
  }
  const fonts = fontFaces.map(({ family, file, weight, style }) => {
    return { family, file, weight, style }
  })
  const tokens = tokensFromTheme(themeCss, fonts, meta)
  const tokenCount = countTokens(tokens)
  const themeTokenCount = readThemeTokens(themeCss).length

  if (tokenCount !== themeTokenCount) {
    throw new Error(`artifact 토큰 ${tokenCount}개가 theme.css 토큰 ${themeTokenCount}개와 다름`)
  }

  const previewHtml = previews.map((preview) => {
    return preview.html
  })
  const candidates = classCandidates(previewHtml, tokens.color.tokens)
  const compiled = await compileStylesheet(componentStylesheets, candidates)
  const projectDirectory = join(outputDirectory, 'design-system', 'project')

  await rm(outputDirectory, { recursive: true, force: true })

  const bundleCss = await replaceFontSources(compiled, fontFaces, (font) => {
    return `../${font.file}`
  })
  const canvasCss = await replaceFontSources(compiled, fontFaces, async (font) => {
    const bytes = await readFile(join(packageDirectory, font.source))

    return `data:font/woff2;base64,${bytes.toString('base64')}`
  })
  const index = {
    v: 3,
    layout: 'files',
    createdOnFiles: { v: 1, at: syncedAt },
    title: SYSTEM_TITLE,
    namespace: SYSTEM_NAMESPACE,
    libraries: [],
    sections: {},
    groups: [],
    assetGroups: {},
    blobs: {},
    docs: { readme: 'project/README.md', sections: [] },
    lastChange: {
      by: 'Claude',
      at: syncedAt,
      via: `GitHub · dungeon-and-dragon/dfragon@${ref}`,
      note: 'packages/design에서 다시 만듦'
    }
  }

  await writeOutput(join(projectDirectory, 'tokens.json'), `${JSON.stringify(tokens, null, 2)}\n`)
  await writeOutput(
    join(projectDirectory, 'design-system.json'),
    `${JSON.stringify(index, null, 2)}\n`
  )
  await writeOutput(join(projectDirectory, 'components', 'bundle.css'), bundleCss)
  await copyFile(join(sourceDirectory, 'README.md'), join(projectDirectory, 'README.md'))

  for (const font of fontFaces) {
    const bytes = await readFile(join(packageDirectory, font.source))

    await writeOutput(join(projectDirectory, font.file), bytes)
  }

  for (const preview of previews) {
    await writeOutput(
      join(projectDirectory, 'components', preview.name, 'preview.html'),
      preview.html
    )
  }

  await writeOutput(join(outputDirectory, 'canvas', CANVAS_STYLESHEET_NAME), canvasCss)

  return { tokenCount, previews: previews.length, projectDirectory }
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url)

if (isEntryPoint) {
  const result = await buildDesignSystem()
  console.log(
    `토큰 ${result.tokenCount}개, preview ${result.previews}개를 ${result.projectDirectory}에 냄`
  )
}
