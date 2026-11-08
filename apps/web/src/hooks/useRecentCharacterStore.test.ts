// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterDisplay } from '../lib/stored-character'
import { RECENT_CHARACTER_LIMIT, useRecentCharacterStore } from './useRecentCharacterStore'

const STORAGE_KEY = 'dfragon:recent-characters'
const START = Date.parse('2026-11-06T00:00:00.000Z')

function character(index: number): CharacterDisplay {
  return {
    serverId: 'cain',
    characterId: `id-${index}`,
    characterName: `캐릭터${index}`,
    adventureName: '가나다',
    guildId: null,
    guildName: null,
    level: 115,
    jobName: '귀검사(남)',
    jobGrowName: '검신',
    fame: 40000 + index,
    role: null
  }
}

function storeState() {
  return useRecentCharacterStore.getState()
}

function recentIds(): string[] {
  return storeState().recentCharacters.map(({ characterId }) => characterId)
}

function viewAt(seconds: number, index: number): void {
  vi.setSystemTime(START + seconds * 1000)
  storeState().addRecentCharacter(character(index))
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: START })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('최근 본 캐릭터 추가', () => {
  it('본 시각과 함께 가장 최근에 본 캐릭터를 맨 앞에 둔다', () => {
    viewAt(0, 1)
    viewAt(1, 2)

    expect(storeState().recentCharacters).toEqual([
      { ...character(2), viewedAt: START + 1000 },
      { ...character(1), viewedAt: START }
    ])
  })

  it('이미 있는 캐릭터를 다시 보면 중복 없이 맨 앞으로 옮기고 본 시각을 새로 적는다', () => {
    viewAt(0, 1)
    viewAt(1, 2)
    viewAt(2, 3)
    viewAt(3, 1)

    expect(recentIds()).toEqual(['id-1', 'id-3', 'id-2'])
    expect(storeState().recentCharacters[0]?.viewedAt).toBe(START + 3000)
  })

  it('10개를 넘으면 가장 오래된 캐릭터부터 버린다', () => {
    for (let index = 1; index <= RECENT_CHARACTER_LIMIT + 1; index += 1) {
      viewAt(index, index)
    }

    expect(storeState().recentCharacters).toHaveLength(10)
    expect(recentIds()[0]).toBe('id-11')
    expect(recentIds()).not.toContain('id-1')
    expect(recentIds()).toContain('id-2')
  })

  it('10개가 찬 뒤 이미 있는 캐릭터를 다시 보면 아무것도 버리지 않는다', () => {
    for (let index = 1; index <= RECENT_CHARACTER_LIMIT; index += 1) {
      viewAt(index, index)
    }
    viewAt(20, 1)

    expect(recentIds()).toHaveLength(10)
    expect(recentIds()[0]).toBe('id-1')
    expect(recentIds()).toContain('id-2')
  })

  it('지우면 그 캐릭터만 사라진다', () => {
    viewAt(0, 1)
    viewAt(1, 2)
    storeState().removeRecentCharacter({ serverId: 'cain', characterId: 'id-1' })

    expect(recentIds()).toEqual(['id-2'])
  })
})

describe('표시 값 갱신', () => {
  it('같은 캐릭터의 표시 값을 새 값으로 바꾸고 순서와 본 시각은 유지한다', () => {
    viewAt(0, 1)
    viewAt(1, 2)
    storeState().refreshRecentCharacter({
      ...character(1),
      characterName: '새 이름',
      adventureName: '라마바',
      jobGrowName: '진 검신',
      fame: 70000
    })

    expect(storeState().recentCharacters).toEqual([
      { ...character(2), viewedAt: START + 1000 },
      {
        ...character(1),
        characterName: '새 이름',
        adventureName: '라마바',
        jobGrowName: '진 검신',
        fame: 70000,
        viewedAt: START
      }
    ])
  })

  it('목록에 없는 캐릭터는 추가하지 않는다', () => {
    storeState().refreshRecentCharacter(character(1))

    expect(storeState().recentCharacters).toEqual([])
  })
})

describe('브라우저 저장', () => {
  it('본 목록을 localStorage에 저장하고 다시 읽는다', () => {
    viewAt(0, 1)
    const savedText = localStorage.getItem(STORAGE_KEY) ?? ''

    expect(JSON.parse(savedText)).toEqual({
      state: { recentCharacters: [{ ...character(1), viewedAt: START }] },
      version: 1
    })

    useRecentCharacterStore.setState({ recentCharacters: [] })
    localStorage.setItem(STORAGE_KEY, savedText)
    useRecentCharacterStore.persist.rehydrate()

    expect(storeState().recentCharacters).toEqual([{ ...character(1), viewedAt: START }])
  })

  it('저장 값이 JSON이 아니면 빈 목록으로 시작한다', () => {
    localStorage.setItem(STORAGE_KEY, '{깨진 값')
    useRecentCharacterStore.persist.rehydrate()

    expect(storeState().recentCharacters).toEqual([])
  })

  it('저장 값의 형태가 틀리면 빈 목록으로 시작한다', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { recentCharacters: 1 }, version: 1 })
    )
    useRecentCharacterStore.persist.rehydrate()

    expect(storeState().recentCharacters).toEqual([])
  })

  it('형태가 틀린 항목은 버리고 10개까지만 읽는다', () => {
    const valid = Array.from({ length: 12 }, (_, index) => ({
      ...character(index),
      viewedAt: index
    }))
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { recentCharacters: [{ ...character(99), viewedAt: '어제' }, ...valid] },
        version: 1
      })
    )
    useRecentCharacterStore.persist.rehydrate()

    expect(recentIds()).toEqual(valid.slice(0, 10).map(({ characterId }) => characterId))
  })

  it('다른 버전으로 저장된 값도 현재 형태로 읽어 오류 없이 이어 쓴다', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { recentCharacters: [{ ...character(1), viewedAt: 1 }, { serverId: 'cain' }] },
        version: 0
      })
    )
    useRecentCharacterStore.persist.rehydrate()

    expect(storeState().recentCharacters).toEqual([{ ...character(1), viewedAt: 1 }])
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
