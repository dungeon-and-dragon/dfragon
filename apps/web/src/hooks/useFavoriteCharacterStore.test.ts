// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterDisplay } from '../lib/stored-character'
import { useFavoriteCharacterStore } from './useFavoriteCharacterStore'

const STORAGE_KEY = 'dfragon:favorite-characters'

const ALPHA: CharacterDisplay = {
  serverId: 'cain',
  characterId: 'alpha-id',
  characterName: '알파',
  adventureName: '가나다',
  guildId: 'guild-1',
  guildName: '길드1',
  level: 115,
  jobName: '귀검사(남)',
  jobGrowName: '검신',
  fame: 50000,
  role: null
}
const BETA = { ...ALPHA, characterId: 'beta-id', characterName: '베타' }

function storeState() {
  return useFavoriteCharacterStore.getState()
}

function storeValue(favoriteCharacters: unknown, version = 1): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { favoriteCharacters }, version }))
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date('2026-11-06T00:00:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('즐겨찾기 추가, 해제', () => {
  it('추가하면 저장 시각과 함께 맨 앞에 쌓인다', () => {
    storeState().addFavoriteCharacter(ALPHA)
    vi.setSystemTime(new Date('2026-11-06T00:00:01.000Z'))
    storeState().addFavoriteCharacter(BETA)

    expect(storeState().favoriteCharacters).toEqual([
      { ...BETA, savedAt: Date.parse('2026-11-06T00:00:01.000Z') },
      { ...ALPHA, savedAt: Date.parse('2026-11-06T00:00:00.000Z') }
    ])
  })

  it('이미 있는 캐릭터를 다시 추가해도 저장 시각을 바꾸지 않는다', () => {
    storeState().addFavoriteCharacter(ALPHA)
    vi.setSystemTime(new Date('2026-11-06T00:00:05.000Z'))
    storeState().addFavoriteCharacter({ ...ALPHA, fame: 1 })

    expect(storeState().favoriteCharacters).toEqual([
      { ...ALPHA, savedAt: Date.parse('2026-11-06T00:00:00.000Z') }
    ])
  })

  it('서버가 다르면 같은 characterId도 다른 캐릭터로 저장한다', () => {
    storeState().addFavoriteCharacter(ALPHA)
    storeState().addFavoriteCharacter({ ...ALPHA, serverId: 'diregie' })

    expect(storeState().favoriteCharacters.map(({ serverId }) => serverId)).toEqual([
      'diregie',
      'cain'
    ])
  })

  it('해제하면 그 캐릭터만 사라진다', () => {
    storeState().addFavoriteCharacter(ALPHA)
    storeState().addFavoriteCharacter(BETA)
    storeState().removeFavoriteCharacter({ serverId: 'cain', characterId: 'alpha-id' })

    expect(storeState().favoriteCharacters.map(({ characterId }) => characterId)).toEqual([
      'beta-id'
    ])
  })
})

describe('표시 값 갱신', () => {
  it('같은 캐릭터의 이름, 모험단, 직업, 명성을 새 값으로 바꾸고 저장 시각은 유지한다', () => {
    storeState().addFavoriteCharacter(ALPHA)
    storeState().addFavoriteCharacter(BETA)
    storeState().refreshFavoriteCharacter({
      ...ALPHA,
      characterName: '알파2',
      adventureName: '라마바',
      jobGrowName: '진 검신',
      fame: 60000
    })

    expect(storeState().favoriteCharacters).toEqual([
      { ...BETA, savedAt: expect.any(Number) },
      {
        ...ALPHA,
        characterName: '알파2',
        adventureName: '라마바',
        jobGrowName: '진 검신',
        fame: 60000,
        savedAt: Date.parse('2026-11-06T00:00:00.000Z')
      }
    ])
  })

  it('목록에 없는 캐릭터는 추가하지 않는다', () => {
    storeState().refreshFavoriteCharacter(ALPHA)

    expect(storeState().favoriteCharacters).toEqual([])
  })
})

describe('브라우저 저장', () => {
  it('추가한 즐겨찾기를 localStorage에 저장하고 다시 읽는다', () => {
    storeState().addFavoriteCharacter(ALPHA)
    const savedText = localStorage.getItem(STORAGE_KEY) ?? ''

    expect(JSON.parse(savedText)).toEqual({
      state: {
        favoriteCharacters: [{ ...ALPHA, savedAt: Date.parse('2026-11-06T00:00:00.000Z') }]
      },
      version: 1
    })

    useFavoriteCharacterStore.setState({ favoriteCharacters: [] })
    localStorage.setItem(STORAGE_KEY, savedText)
    useFavoriteCharacterStore.persist.rehydrate()

    expect(storeState().favoriteCharacters).toEqual([
      { ...ALPHA, savedAt: Date.parse('2026-11-06T00:00:00.000Z') }
    ])
  })

  it('저장 값이 JSON이 아니면 빈 목록으로 시작한다', () => {
    localStorage.setItem(STORAGE_KEY, '{깨진 값')
    useFavoriteCharacterStore.persist.rehydrate()

    expect(storeState().favoriteCharacters).toEqual([])
  })

  it('저장 값의 형태가 틀리면 빈 목록으로 시작한다', () => {
    storeValue('목록이 아님')
    useFavoriteCharacterStore.persist.rehydrate()

    expect(storeState().favoriteCharacters).toEqual([])
  })

  it('형태가 틀린 항목만 버리고 나머지는 읽는다', () => {
    const saved = { ...ALPHA, savedAt: 1 }
    storeValue([saved, { ...BETA, savedAt: '어제' }, { ...BETA, fame: '많음', savedAt: 1 }, null])
    useFavoriteCharacterStore.persist.rehydrate()

    expect(storeState().favoriteCharacters).toEqual([saved])
  })

  it('역할을 저장하기 전의 항목은 역할을 모른다고 읽는다', () => {
    const { role: _role, ...beforeRole } = { ...ALPHA, savedAt: 1 }
    storeValue([beforeRole])
    useFavoriteCharacterStore.persist.rehydrate()

    expect(storeState().favoriteCharacters).toEqual([{ ...ALPHA, role: null, savedAt: 1 }])
  })

  it('다른 버전으로 저장된 값도 현재 형태로 읽어 오류 없이 이어 쓴다', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    storeValue([{ ...ALPHA, savedAt: 1 }, { serverId: 'cain' }], 0)
    useFavoriteCharacterStore.persist.rehydrate()

    expect(storeState().favoriteCharacters).toEqual([{ ...ALPHA, savedAt: 1 }])
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
