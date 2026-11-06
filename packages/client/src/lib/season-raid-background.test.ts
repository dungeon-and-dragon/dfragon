import { describe, expect, it } from 'vitest'
import { findSeasonRaidBackground } from './season-raid-background'

const SEASONS = [5, 6, 7, 8, 9, 10, 11]

describe('findSeasonRaidBackground', () => {
  it('시즌 5부터 11까지 시즌마다 서로 다른 배경 이미지를 돌려준다', () => {
    const backgrounds = SEASONS.map(findSeasonRaidBackground)

    expect(backgrounds.every((background) => background?.endsWith('.webp'))).toBe(true)
    expect(new Set(backgrounds).size).toBe(SEASONS.length)
  })

  it('표에 없는 시즌은 undefined로 돌려준다', () => {
    expect(findSeasonRaidBackground(4)).toBeUndefined()
    expect(findSeasonRaidBackground(12)).toBeUndefined()
  })
})
