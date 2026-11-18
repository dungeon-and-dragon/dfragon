export type ThemeToken = {
  name: string
  value: string
  note: string | null
}

export type TokenSection =
  | 'color'
  | 'typography'
  | 'spacing'
  | 'size'
  | 'radius'
  | 'layer'
  | 'breakpoint'
  | 'shadow'
  | 'motion'

const SECTION_PREFIXES: Readonly<Record<TokenSection, readonly string[]>> = {
  color: ['--gray-', '--color-', '--gradient-'],
  typography: ['--font-', '--text-', '--leading-', '--tracking-'],
  spacing: ['--spacing'],
  size: ['--height-', '--container-', '--size-'],
  radius: ['--radius-'],
  layer: ['--z-'],
  breakpoint: ['--breakpoint-'],
  shadow: ['--shadow-', '--inset-shadow-', '--drop-shadow-'],
  motion: ['--ease-', '--duration-', '--default-transition-', '--animate-', '--cycle', '--beat']
}

const TOKEN_BLOCK_PATTERN = /^(?::root|@theme\b.*)$/u
const DECLARATION_PATTERN = /\/\*([\s\S]*?)\*\/|(--[\w-]+)\s*:\s*([^;]+);/gu
const COMMENT_PATTERN = /\/\*[\s\S]*?\*\//gu
const BLANK_LINE_PATTERN = /\n[ \t]*\n/u
const WHITESPACE_PATTERN = /\s+/gu
const LIGHT_DARK_PATTERN = /^light-dark\((.*)\)$/u
const VARIABLE_PATTERN = /var\((--[\w-]+)\)/gu

function topLevelBlocks(source: string): { selector: string; body: string }[] {
  const blocks: { selector: string; body: string }[] = []
  let depth = 0
  let selectorStart = 0
  let bodyStart = 0

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '{') {
      if (depth === 0) {
        const selector = source.slice(selectorStart, index)
        bodyStart = index + 1
        blocks.push({ selector, body: '' })
      }

      depth += 1
    } else if (character === '}') {
      depth -= 1

      if (depth === 0) {
        const block = blocks.at(-1)

        if (block !== undefined) {
          block.body = source.slice(bodyStart, index)
        }

        selectorStart = index + 1
      }
    }
  }

  return blocks
}

function withoutComments(text: string): string {
  return text.replace(COMMENT_PATTERN, '').trim()
}

// @media 안의 :root처럼 이미 있는 토큰을 덮는 블록은 새 토큰이 아니므로 맨 바깥의 :root와 @theme만 읽는다.
export function readThemeTokens(source: string): ThemeToken[] {
  const tokens: ThemeToken[] = []
  const blocks = topLevelBlocks(source).filter(({ selector }) => {
    const isTokenBlock = TOKEN_BLOCK_PATTERN.test(withoutComments(selector))

    return isTokenBlock
  })

  for (const { body } of blocks) {
    let note: string | null = null
    let previousEnd = 0

    for (const match of body.matchAll(DECLARATION_PATTERN)) {
      const gap = body.slice(previousEnd, match.index)
      previousEnd = match.index + match[0].length

      if (BLANK_LINE_PATTERN.test(gap)) {
        note = null
      }

      const [, comment, name, value] = match

      if (comment !== undefined) {
        note = comment.trim()
        continue
      }

      if (name !== undefined && value !== undefined) {
        const normalizedValue = value.replace(WHITESPACE_PATTERN, ' ').trim()
        tokens.push({ name, value: normalizedValue, note })
      }
    }
  }

  return tokens
}

export function sectionOf(name: string): TokenSection | null {
  const sections = Object.keys(SECTION_PREFIXES) as TokenSection[]
  const section = sections.find((candidate) => {
    const matches = SECTION_PREFIXES[candidate].some((prefix) => name.startsWith(prefix))

    return matches
  })

  if (section === undefined) {
    return null
  }

  return section
}

export function tokensIn(tokens: readonly ThemeToken[], section: TokenSection): ThemeToken[] {
  return tokens.filter((token) => sectionOf(token.name) === section)
}

function splitTopLevelComma(text: string): [string, string] | null {
  let depth = 0

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '(') {
      depth += 1
    } else if (character === ')') {
      depth -= 1
    } else if (character === ',' && depth === 0) {
      return [text.slice(0, index).trim(), text.slice(index + 1).trim()]
    }
  }

  return null
}

export function resolveVariables(value: string, tokens: readonly ThemeToken[]): string {
  const values = new Map(tokens.map((token) => [token.name, token.value]))

  return value.replace(VARIABLE_PATTERN, (reference, name: string) => {
    const resolved = values.get(name)

    if (resolved === undefined) {
      return reference
    }

    return resolved
  })
}

export type ModeValues = { light: string; dark: string }

export function modeValues(value: string, tokens: readonly ThemeToken[]): ModeValues {
  const resolved = resolveVariables(value, tokens)
  const inner = LIGHT_DARK_PATTERN.exec(resolved)?.[1]
  const pair = inner !== undefined ? splitTopLevelComma(inner) : null

  if (pair === null) {
    return { light: resolved, dark: resolved }
  }

  return { light: pair[0], dark: pair[1] }
}
