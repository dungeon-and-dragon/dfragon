import { describe, expect, it, vi } from 'vitest'
import { type CharacterDetailBody, characterDetailResponse } from '../testing/character-detail'
import { createDfragonClient } from '../api/dfragon-client'
import { SearchHttpFailure } from '../api/http'

const API_ORIGIN = 'https://api.example.test'

function identityOf(body: Pick<CharacterDetailBody, 'character'>) {
  return { serverId: body.character.serverId, characterId: body.character.characterId }
}

function load(body: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify(body), { status })
  )

  return createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).characters.detailView
}

describe('캐릭터 상세 화면 응답', () => {
  it('딜러 fixture의 장비, 세트, 서약, 크리쳐, 아바타, 스킬, 버프 강화, 스탯을 읽는다', async () => {
    const body = characterDetailResponse('dealer')
    const detail = await load(body)(identityOf(body))

    expect(detail.character).toMatchObject({ serverName: '카인', level: 115, fame: null })
    expect(detail.card?.role).toBe('dealer')
    const slots = detail.equipment.equipment.map((item) => item.slotId)
    expect(slots).toHaveLength(13)
    expect(slots[0]).toBe('WEAPON')
    expect(detail.equipment.equipment[0]).toMatchObject({
      itemRarity: '태초',
      reinforce: 10,
      amplificationName: null,
      refine: 0,
      exaltedInfo: null,
      potency: null
    })
    expect(detail.equipment.equipment[0].enchant?.status).toEqual([
      { name: '화속성강화', value: 15 },
      { name: '명속성강화', value: 15 }
    ])
    expect(detail.equipment.equipment[2].tune).toEqual([{ level: 0, setPoint: 235 }])
    expect(detail.equipment.equipment[12]).toMatchObject({
      slotId: 'EARRING',
      reinforce: 8,
      amplificationName: '차원의 힘'
    })
    expect(detail.equipment.setItemInfo[0]).toMatchObject({
      setItemName: '로열 페어리 세트',
      active: { setPoint: { current: 2615, min: 2550, max: 2550 } }
    })
    expect(detail.oath?.crystal).toHaveLength(11)
    expect(detail.oath?.crystal[0]).toMatchObject({
      slotNo: 0,
      itemName: '용투 : 완전한 광휘 결정',
      tune: { level: 3, setPoint: 195 }
    })
    expect(detail.oath?.info?.oathUpgrade?.options[0]).toMatchObject({ optionName: '고요한 호흡' })
    expect(detail.oath?.info?.oathUpgrade?.options[0].status[0]).toEqual({
      key: '스킬 쿨타임 감소',
      value: '8%'
    })
    expect(detail.creature?.artifact[0]).toMatchObject({ slotColor: 'RED', itemRarity: '유니크' })
    expect(detail.avatar.map((avatar) => avatar.slotId)).toContain('AURORA')
    expect(detail.mistAssimilation?.status[0]).toEqual({ name: '최종 데미지 증가', value: '53%' })
    expect(detail.skillStyle?.style?.passive).toHaveLength(9)
    expect(detail.skillStyle?.style?.passive[0]).toMatchObject({
      name: '기본기 숙련',
      level: 115,
      requiredLevel: 1
    })
    expect(detail.skillStyle?.style?.evolution[0]).toMatchObject({ type: 1 })
    expect(detail.skillStyle?.hash).toMatch(/^eJyNjDFOAlEARN9b/)
    expect(detail.skillStyle?.style?.chain).toEqual({
      resetTime: 0,
      skills: [
        'fc7a3f4c2852c832a2f20af63d5d212f',
        '8c10cefa65364880451e389bb74d3600',
        '4b2c90ec226fd40e967875aa5eabefb2',
        '128b9ddef2262f40723deae4407bdb42'
      ]
    })
    expect(detail.oath?.setInfo).toMatchObject({ setId: 16204, setRarityName: '태초' })
    expect(detail.buff.equipment?.equipment).toEqual([])
    expect(detail.buff.avatar?.avatar.map((avatar) => avatar.slotId)).toEqual(['JACKET'])
    expect(detail.buff.creature?.skillInfo?.option).toMatchObject({ level: 16 })
    expect(detail.buff.creature?.skillInfo?.option?.values).toHaveLength(3)
    expect(detail.status.status).toHaveLength(79)
    expect(detail.status.status[0]).toEqual({ name: 'HP', value: 176036 })
    expect(detail.status.buff[0]).toEqual({
      name: '모험단 버프',
      level: 41,
      status: [
        { name: '힘', value: 290 },
        { name: '지능', value: 290 },
        { name: '체력', value: 290 },
        { name: '정신력', value: 290 }
      ]
    })
    expect(detail.status.buff[1]).toMatchObject({ name: '무제한 길드능력치', level: null })
    expect(detail.avatar[0].clone).toEqual({
      itemId: '9d2ba5dfe1f49c5a5e31dd0d6665d1de',
      itemName: '인페르노의 장식핀[B타입]'
    })
  })

  it('버퍼 fixture의 증폭 장비, 재련 무기, 강화 옵션이 없는 서약, 버프 강화 장비를 읽는다', async () => {
    const body = characterDetailResponse('buffer')
    const detail = await load(body)(identityOf(body))

    expect(detail.card?.role).toBe('buffer')
    expect(detail.equipment.equipment[0]).toMatchObject({ slotId: 'WEAPON', refine: 8 })
    expect(detail.equipment.equipment[10]).toMatchObject({
      slotId: 'SUPPORT',
      reinforce: 6,
      amplificationName: '차원의 정신력'
    })
    expect(detail.oath?.info).toMatchObject({ oathUpgrade: null })
    expect(detail.oath?.setInfo?.active).toMatchObject({ status: [] })
    expect(detail.oath?.blessing?.status[0]).toEqual({ key: '최종 데미지 증가', value: '20%' })
    expect(detail.buff.equipment?.equipment[0]).toMatchObject({ slotId: 'TITLE' })
    expect(detail.buff.creature?.creature).toEqual([])
    expect(detail.skillStyle?.style?.passive).toHaveLength(14)
    expect(detail.skillStyle?.style?.chain).toBeNull()
  })

  it('빈 슬롯과 칸이 빠진 장비는 실패하지 않고 빈 값으로 읽는다', async () => {
    const body = characterDetailResponse('dealer')
    body.equipment.equipment = body.equipment.equipment.filter((item) => item.slotId !== 'TITLE')
    body.equipment.equipment[0] = { slotId: 'WEAPON', tune: null, enchant: [] }
    body.avatar = body.avatar.filter((avatar) => avatar.slotId !== 'AURORA')
    const detail = await load(body)(identityOf(body))

    expect(detail.equipment.equipment.map((item) => item.slotId)).not.toContain('TITLE')
    expect(detail.equipment.equipment[0]).toEqual({
      slotId: 'WEAPON',
      slotName: null,
      itemId: null,
      itemName: null,
      itemRarity: null,
      reinforce: null,
      amplificationName: null,
      refine: null,
      tune: [],
      enchant: null,
      exaltedInfo: null,
      potency: null
    })
    expect(detail.avatar.map((avatar) => avatar.slotId)).not.toContain('AURORA')
  })

  it('유일 장비의 옵션과 정밀도를 읽는다', async () => {
    const body = characterDetailResponse('dealer')
    Object.assign(body.equipment.equipment[9], {
      exaltedInfo: { damage: 1, buff: 1, explain: '장착 중인 가장 높은 세트 포인트' },
      potency: { value: 100, damage: 1, buff: 1 }
    })
    const detail = await load(body)(identityOf(body))

    expect(detail.equipment.equipment[9]).toMatchObject({
      slotId: 'RING',
      exaltedInfo: { explain: '장착 중인 가장 높은 세트 포인트' },
      potency: { value: 100 }
    })
  })

  it.each([
    ['null', null],
    ['빈 객체', {}]
  ])('서약이 %s인 캐릭터를 실패 없이 읽는다', async (_, oath) => {
    const body = characterDetailResponse('buffer')
    body.oath = oath
    const detail = await load(body)(identityOf(body))

    expect(detail.oath).toEqual(
      oath === null ? null : { info: null, crystal: [], blessing: null, setInfo: null }
    )
  })

  it('character만 있고 나머지 섹션이 통째로 없는 응답은 빈 섹션으로 읽는다', async () => {
    const { character } = characterDetailResponse('dealer')
    const detail = await load({ character })(identityOf({ character }))

    expect(detail).toEqual({
      character: expect.objectContaining({ characterId: character.characterId }),
      card: null,
      equipment: { equipment: [], setItemInfo: [] },
      creature: null,
      avatar: [],
      mistAssimilation: null,
      oath: null,
      skillStyle: null,
      buff: { equipment: null, avatar: null, creature: null },
      status: { status: [], buff: [] }
    })
  })

  it('character가 없거나 요청한 캐릭터가 아니면 SEARCH_RESPONSE_INVALID로 실패한다', async () => {
    const body = characterDetailResponse('dealer')
    const identity = identityOf(body)

    await expect(load({ ...body, character: undefined })(identity)).rejects.toMatchObject({
      code: 'SEARCH_RESPONSE_INVALID'
    })
    await expect(
      load(body)({ serverId: identity.serverId, characterId: 'other-character' })
    ).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
  })

  it.each([
    [404, 'CHARACTER_NOT_FOUND', 'API가 보낸 없는 캐릭터 문구'],
    [502, 'NEOPLE_API_ERROR', '캐릭터 정보 조회 중 오류가 발생했습니다.']
  ])('API %i 오류 응답(%s)의 error.message를 오류 문구로 준다', async (status, code, message) => {
    const error = load(
      { error: { code, message } },
      status
    )({
      serverId: 'cain',
      characterId: 'missing-character'
    })

    await expect(error).rejects.toBeInstanceOf(SearchHttpFailure)
    await expect(error).rejects.toMatchObject({ code, message })
  })
})
