import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import {
  buildDesignSystem,
  readFontFaces,
  tokensFromTheme
} from '../scripts/build-design-system.mjs'

const VARIABLE_DEFINITION_PATTERN = /^\s*(--[a-z0-9-]+)\s*:/gm
const TEXT_STYLE_SUFFIXES = {
  lineHeight: '--line-height',
  fontWeight: '--font-weight',
  letterSpacing: '--letter-spacing'
}

let outputDirectory
let projectDirectory

before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), 'dfragon-design-system-'))
  ;({ projectDirectory } = await buildDesignSystem({ outputDirectory }))
})

after(async () => {
  await rm(outputDirectory, { recursive: true, force: true })
})

async function readJson(path) {
  const content = await readFile(join(projectDirectory, path), 'utf8')

  return JSON.parse(content)
}

function textVariableNames(tokens) {
  return tokens.type.groups
    .flatMap((group) => {
      return group.styles
    })
    .flatMap((style) => {
      const suffixes = Object.entries(TEXT_STYLE_SUFFIXES)
        .filter(([property]) => {
          const isPresent = style[property] != null

          return isPresent
        })
        .map(([, suffix]) => {
          return `text-${style.name}${suffix}`
        })

      return [`text-${style.name}`, ...suffixes]
    })
}

function themeVariableNames(theme) {
  const reducedMotion = theme.indexOf('@media (prefers-reduced-motion')

  return new Set(
    [...theme.slice(0, reducedMotion).matchAll(VARIABLE_DEFINITION_PATTERN)].map((match) => {
      return match[1].slice(2)
    })
  )
}

test('artifact 토큰은 theme.css의 변수와 이름이 하나씩 맞는다', async () => {
  const theme = await readFile(new URL('../theme.css', import.meta.url), 'utf8')
  const tokens = await readJson('tokens.json')
  const listed = Object.values(tokens)
    .filter((family) => {
      const isTokenList = Array.isArray(family?.tokens)

      return isTokenList
    })
    .flatMap((family) => {
      return family.tokens.map((token) => {
        return token.name
      })
    })
  const families = Object.keys(tokens.type.families).map((key) => {
    return `font-${key}`
  })

  const names = [...listed, ...families, ...textVariableNames(tokens)]

  assert.deepEqual(new Set(names), themeVariableNames(theme))
  assert.equal(names.length, themeVariableNames(theme).size)
  assert.deepEqual(Object.keys(tokens.type.families), ['sans', 'mono'])
  assert.ok(
    tokens.fontWeight.tokens.every((token) => {
      const isWeight = token.name.startsWith('font-weight-')

      return isWeight
    })
  )
})

test('--text-* 변수는 하위 변수와 묶어 글자 단계 하나로 낸다', () => {
  const theme = [
    ':root {',
    '  --gray-0: #ffffff;',
    '}',
    '@theme static {',
    '  /* 표 본문 */',
    '  --text-body: 14px;',
    '  --text-body--line-height: 20px;',
    '  --text-body--font-weight: 500;',
    "  --font-sans: 'IBM Plex Sans KR', sans-serif;",
    '}'
  ].join('\n')
  const tokens = tokensFromTheme(theme, [], {})

  assert.deepEqual(tokens.type.groups, [
    {
      name: '글자 단계',
      family: 'sans',
      styles: [
        {
          name: 'body',
          fontSize: '14px',
          usage: '표 본문',
          lineHeight: '20px',
          fontWeight: '500'
        }
      ]
    }
  ])
})

test('theme.css에 artifact family가 없는 접두어가 있으면 빌드를 멈춘다', () => {
  const theme = [':root {', '}', '@theme static {', '  --elevation-popover: 10;', '}'].join('\n')

  assert.throws(() => {
    tokensFromTheme(theme, [], {})
  }, /--elevation-popover/)
})

test('색 토큰은 var()를 풀어 라이트와 다크 값을 따로 낸다', async () => {
  const tokens = await readJson('tokens.json')
  const canvas = tokens.color.tokens.find((token) => {
    return token.name === 'color-canvas'
  })
  const values = tokens.color.tokens.flatMap((token) => {
    if (typeof token.value === 'string') {
      return [token.value]
    }

    return Object.values(token.value)
  })

  assert.deepEqual(canvas.value, { light: '#ffffff', dark: '#0a0a0b' })
  assert.deepEqual(
    values.filter((value) => {
      const isUnresolved = value.includes('var(') || value.includes('light-dark(')

      return isUnresolved
    }),
    []
  )
})

test('base.css의 글꼴 파일을 모두 fonts에 넣고 tokens.json에 적는다', async () => {
  const tokens = await readJson('tokens.json')
  const baseCss = await readFile(new URL('../base.css', import.meta.url), 'utf8')
  const families = new Set(
    tokens.type.fonts.map((font) => {
      return font.family
    })
  )

  assert.equal(tokens.type.fonts.length, readFontFaces(baseCss).length)
  assert.deepEqual([...families], ['IBM Plex Sans KR', 'Monoplex KR'])

  for (const font of tokens.type.fonts) {
    const copied = await stat(join(projectDirectory, font.file))
    const original = await stat(new URL(`../${font.file}`, import.meta.url))

    assert.equal(copied.size, original.size, font.file)
  }
})

test('숫자 글꼴의 % 전용 face는 굵기마다 unicode-range를 tokens.json에 적고 전체 face보다 뒤에 둔다', async () => {
  const tokens = await readJson('tokens.json')
  const baseCss = await readFile(new URL('../base.css', import.meta.url), 'utf8')
  const percentFonts = tokens.type.fonts.filter((font) => {
    return font.family === 'Monoplex KR' && font.unicodeRange === 'U+0025'
  })
  const monoFaces = readFontFaces(baseCss).filter((face) => face.family === 'Monoplex KR')
  const lastFullFace = monoFaces.findLastIndex((face) => face.unicodeRange === undefined)
  const firstPercentFace = monoFaces.findIndex((face) => face.unicodeRange === 'U+0025')

  assert.deepEqual(
    percentFonts.map(({ file, weight }) => `${weight} ${file}`),
    [
      '400 fonts/IBMPlexSansKR-Regular.woff2',
      '500 fonts/IBMPlexSansKR-Medium.woff2',
      '600 fonts/IBMPlexSansKR-SemiBold.woff2',
      '700 fonts/IBMPlexSansKR-Bold.woff2'
    ]
  )
  assert.ok(lastFullFace < firstPercentFace)
})

test('컴파일한 CSS는 저장소 토큰이 artifact의 tokens.css를 이기게 theme layer 밖에 둔다', async () => {
  const css = await readFile(join(projectDirectory, 'components', 'bundle.css'), 'utf8')

  assert.doesNotMatch(css, /@layer theme\s*\{/)
  assert.match(css, /--color-canvas:\s*light-dark\(/)
  assert.match(css, /\.bg-canvas\s*\{\s*background-color:\s*var\(--color-canvas\)/)
  assert.match(css, /url\('\.\.\/fonts\/IBMPlexSansKR-Regular\.woff2'\)/)
  assert.match(css, /:root\[data-theme='dark'\]\s*\{\s*color-scheme:\s*dark;/)
})

test('캔버스 CSS는 글꼴을 data URI로 넣어 파일 하나로 쓴다', async () => {
  const css = await readFile(join(outputDirectory, 'canvas', 'dfragon-design.css'), 'utf8')

  assert.match(css, /url\('data:font\/woff2;base64,/)
  assert.doesNotMatch(css, /url\('\.\.?\/fonts\//)
})

test('preview는 표지, Foundations와 컴포넌트마다 카드를 marker와 함께 낸다', async () => {
  for (const name of [
    'Cover',
    'Surfaces',
    'Button',
    'IconButton',
    'TextField',
    'Switch',
    'Checkbox',
    'Chip',
    'Listbox',
    'Popover',
    'Select',
    'Tabs',
    'Tooltip'
  ]) {
    const html = await readFile(join(projectDirectory, 'components', name, 'preview.html'), 'utf8')

    assert.match(html.split('\n')[0], /^<!-- @dsCard /, name)
  }
})
