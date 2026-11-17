import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { modeValues, readThemeTokens, sectionOf } from './theme-tokens'

const themePath = fileURLToPath(import.meta.resolve('@dfragon/design/theme.css'))
const themeSource = readFileSync(themePath, 'utf8')
const DECLARED_NAME_PATTERN = /^\s*(--[a-z0-9-]+)\s*:/gmu

// 파서와 다른 방법으로 선언 이름만 모은다. @media 안의 덮어쓰기는 같은 이름이라 집합 비교에 영향이 없다.
function declaredNames(source: string): string[] {
  return [...source.matchAll(DECLARED_NAME_PATTERN)].map((match) => match[1] ?? '')
}

describe('readThemeTokens', () => {
  test('바깥 :root와 @theme의 토큰을 읽고 @media 안의 덮어쓰기와 와일드카드 초기화는 토큰으로 세지 않는다', () => {
    const tokens = readThemeTokens(`
      :root {
        --gray-0: #ffffff;
      }
      @theme static {
        --color-*: initial;
        --duration-hover: 120ms;
      }
      @media (prefers-reduced-motion: reduce) {
        :root {
          --duration-hover: 0ms;
        }
      }
    `)

    expect(tokens.map(({ name, value }) => [name, value])).toEqual([
      ['--gray-0', '#ffffff'],
      ['--duration-hover', '120ms']
    ])
  })

  test('주석은 빈 줄이나 다음 주석 전까지 이어지는 토큰의 설명이 된다', () => {
    const tokens = readThemeTokens(`
      @theme {
        /* 카드 면 */
        --color-card: #111111;
        --color-card-hover: #222222;

        --color-plain: #333333;
        /* 그림자 */
        --shadow-popover: 0 8px 24px
          rgb(0 0 0 / 12%);
      }
    `)

    expect(tokens).toEqual([
      { name: '--color-card', value: '#111111', note: '카드 면' },
      { name: '--color-card-hover', value: '#222222', note: '카드 면' },
      { name: '--color-plain', value: '#333333', note: null },
      { name: '--shadow-popover', value: '0 8px 24px rgb(0 0 0 / 12%)', note: '그림자' }
    ])
  })
})

describe('modeValues', () => {
  const tokens = readThemeTokens(`
    :root {
      --gray-0: #ffffff;
      --gray-950: #0a0a0b;
    }
  `)

  test('light-dark의 두 값을 원색 단계 값으로 풀어 나눈다', () => {
    expect(modeValues('light-dark(var(--gray-0), rgb(0 0 0 / 45%))', tokens)).toEqual({
      light: '#ffffff',
      dark: 'rgb(0 0 0 / 45%)'
    })
  })

  test('모드와 관계없는 값은 두 모드에 같은 값을 준다', () => {
    expect(modeValues('var(--gray-950)', tokens)).toEqual({ light: '#0a0a0b', dark: '#0a0a0b' })
  })
})

test('theme.css에 선언한 토큰을 빠짐없이 읽고 모두 Foundations의 한 section에 넣는다', () => {
  const tokenNames = readThemeTokens(themeSource).map(({ name }) => name)
  const unsorted = tokenNames.filter((name) => sectionOf(name) === null)

  expect(new Set(tokenNames)).toEqual(new Set(declaredNames(themeSource)))
  expect(unsorted).toEqual([])
})
