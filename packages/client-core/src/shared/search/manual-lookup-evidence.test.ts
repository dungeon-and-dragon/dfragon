import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { CharacterCandidate, CharacterDetails } from '../../preload/common/types/character'
import type {
  ManualCharacterLookup,
  OcrSearchObservation,
  RaidRowObservation
} from '../../preload/common/types/search'
import type {
  CharacterCandidatesHttp,
  CharacterDetailsHttp,
  CharacterImageHttp
} from './character-http'
import type { PortraitColorScorer } from './portrait-color'
import { createCaptureSearchLifetime } from './capture-lifetime'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'

const TYPED_NAME = '고친이름'
const SERVERS = [
  { serverId: 'cain', fame: 60_000, jobGrowName: '眞 웨펀마스터', imageCode: 1 },
  { serverId: 'siroco', fame: 50_000, jobGrowName: '眞 버서커', imageCode: 2 },
  { serverId: 'hilder', fame: 40_000, jobGrowName: '眞 소울브링어', imageCode: 3 }
]
const CONFIDENT_FACE = 10
const AMBIGUOUS_FACE = 20
// 합성 얼굴 코드별 후보 이미지 거리. 초기 정책의 maxDistance 40, minMargin 3 기준으로 첫 얼굴은 siroco로 확정하고
// 둘째 얼굴은 cain과 siroco의 차이가 작아 확정하지 못한다.
const DISTANCES: Record<number, Record<number, number>> = {
  [CONFIDENT_FACE]: { 1: 30, 2: 5, 3: 30 },
  [AMBIGUOUS_FACE]: { 1: 10, 2: 11, 3: 30 }
}

function candidate(server: (typeof SERVERS)[number], name: string): CharacterCandidate {
  return {
    characterId: `id-${server.serverId}`,
    characterName: name,
    serverId: server.serverId,
    serverName: server.serverId,
    fame: server.fame,
    imageUrl: `https://img-api.neople.co.kr/df/servers/${server.serverId}/characters/id?zoom=1`,
    adventureName: null,
    jobName: '귀검사(남)',
    jobGrowName: server.jobGrowName
  }
}

function details({ serverId, characterId }: { serverId: string; characterId: string }) {
  const value: CharacterDetails = {
    character: {
      characterId,
      serverId,
      serverName: serverId,
      characterName: TYPED_NAME,
      level: 115
    },
    status: { status: [], buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: {},
    freshness: {
      lastSuccessfulFetchAt: '2026-11-03T00:00:00.000Z',
      expiresAt: '2026-11-03T00:05:00.000Z'
    }
  }

  return value
}

function face(code: number) {
  return { image: { width: 1, height: 1, rgba: new Uint8Array([code, 0, 0, 255]) }, rasterScale: 1 }
}

function fixture(kind: 'party' | 'raid') {
  const candidates = vi.fn<CharacterCandidatesHttp>(async ({ nickname }) => {
    if (nickname !== TYPED_NAME) {
      return [{ ...candidate(SERVERS[0], nickname), serverId: 'bakal', characterId: 'id-bakal' }]
    }

    return SERVERS.map((server) => candidate(server, nickname))
  })
  const image = vi.fn<CharacterImageHttp>(async ({ serverId }) => {
    const code = SERVERS.find((server) => server.serverId === serverId)!.imageCode

    return { width: 1, height: 1, rgba: new Uint8Array([code, 0, 0, 255]) }
  })
  const scorePortrait = vi.fn<PortraitColorScorer>(async ({ portrait, candidate }) => {
    const distance = DISTANCES[portrait.image.rgba[0]][candidate.rgba[0]]

    return {
      distance,
      coverage: 1,
      comparedCells: 64,
      alignment: { x: 0, y: 0, width: 1, height: 1 }
    }
  })
  const getDetails = vi.fn<CharacterDetailsHttp>(async (identity) => details(identity))
  const lifetime = createCaptureSearchLifetime({
    publish: vi.fn(),
    isCurrent: () => true,
    isCurrentOcr: () => true,
    slotCount: kind === 'raid' ? 12 : 4,
    runtime: {
      identification: {
        candidates,
        image,
        details: getDetails,
        scorePortrait,
        selection: INITIAL_PORTRAIT_COLOR_POLICY
      },
      ocrIdentification: kind === 'raid' ? 'raid' : undefined,
      reportDiagnostic: vi.fn()
    }
  })
  onTestFinished(() => lifetime.invalidate())
  let captureId = ''
  let revision = 0
  // Desktop IPC와 웹처럼 새 회차의 BEGIN은 이전 수명을 끝낸 뒤 시작한다.
  const beginRound = () => {
    lifetime.invalidate()
    captureId = lifetime.begin({ windowGeneration: 1, sourceGeneration: 1 }).snapshot.captureId!
    revision = 0
  }
  const settled = async () => {
    await vi.waitFor(() => expect(lifetime.snapshot().slots[0].state).not.toBe('pending'))

    return lifetime.snapshot().slots[0]
  }
  const observe = (
    input: Pick<OcrSearchObservation, 'nickname' | 'portrait'> & { raidRow?: RaidRowObservation }
  ) => {
    revision += 1
    lifetime.observeOcr({
      captureId,
      slot: 0,
      observationRevision: revision,
      candidateNicknames: [input.nickname],
      ...input
    })

    return settled()
  }
  const lookup = (input: Pick<ManualCharacterLookup, 'nickname' | 'serverId'>) => {
    revision += 1
    lifetime.lookup({ captureId, slot: 0, observationRevision: revision, ...input })

    return settled()
  }
  const comparedFaces = () =>
    scorePortrait.mock.calls.map(([input]) => input.portrait.image.rgba[0])
  beginRound()

  return { image, scorePortrait, beginRound, observe, lookup, comparedFaces }
}

describe('서버 없이 이름 칸에서 조회한 파티 자리', () => {
  it('OCR이 다른 실존 이름으로 읽은 자리도 그 서버를 쓰지 않고 그 자리의 얼굴로 고른 뒤 상세까지 채운다', async () => {
    const f = fixture('party')
    expect(await f.observe({ nickname: '잘못읽음', portrait: face(CONFIDENT_FACE) })).toMatchObject(
      {
        selected: { serverId: 'bakal' }
      }
    )

    const slot = await f.lookup({ nickname: TYPED_NAME })

    expect(slot).toMatchObject({
      state: 'success',
      selectionMethod: 'portrait',
      selected: { characterName: TYPED_NAME, serverId: 'siroco', level: 115 }
    })
    expect(slot).not.toHaveProperty('choices')
    expect(slot).not.toHaveProperty('details')
    expect(f.comparedFaces()).toEqual([CONFIDENT_FACE, CONFIDENT_FACE, CONFIDENT_FACE])
  })

  it('얼굴 비교가 확정 기준에 못 미치면 가장 가까운 후보를 고르고 후보 창의 후보를 함께 준다', async () => {
    const f = fixture('party')
    await f.observe({ nickname: '못찾음', portrait: face(AMBIGUOUS_FACE) })

    const slot = await f.lookup({ nickname: TYPED_NAME })

    expect(slot).toMatchObject({ selectionMethod: 'portrait', selected: { serverId: 'cain' } })
    expect(slot.choices?.map((choice) => choice.serverId)).toEqual(['cain', 'siroco', 'hilder'])
  })

  it('같은 회차에서 다시 입력해도 같은 얼굴을 쓰고 새 회차는 새 관측의 얼굴을 쓴다', async () => {
    const f = fixture('party')
    await f.observe({ nickname: '못찾음', portrait: face(CONFIDENT_FACE) })
    await f.lookup({ nickname: TYPED_NAME })
    await f.lookup({ nickname: '다른이름' })
    const again = await f.lookup({ nickname: TYPED_NAME })
    expect(again.selected?.serverId).toBe('siroco')

    f.beginRound()
    await f.observe({ nickname: '못찾음', portrait: face(AMBIGUOUS_FACE) })
    const next = await f.lookup({ nickname: TYPED_NAME })

    expect(next.selected?.serverId).toBe('cain')
    expect(f.comparedFaces()).toEqual([
      ...Array(6).fill(CONFIDENT_FACE),
      ...Array(3).fill(AMBIGUOUS_FACE)
    ])
  })

  it('새 회차가 관측 없이 시작되면 이전 회차의 얼굴을 쓰지 않는다', async () => {
    const f = fixture('party')
    await f.observe({ nickname: '못찾음', portrait: face(CONFIDENT_FACE) })
    f.beginRound()

    expect(await f.lookup({ nickname: TYPED_NAME })).toMatchObject({
      selectionMethod: 'highest-fame',
      selected: { serverId: 'cain' }
    })
    expect(f.image).not.toHaveBeenCalled()
  })

  it('OCR 관측이 없는 빈 자리는 최고 명성 후보를 고르고 동명 후보 전부를 후보 창에 준다', async () => {
    const f = fixture('party')

    const slot = await f.lookup({ nickname: TYPED_NAME })

    expect(slot).toMatchObject({
      selectionMethod: 'highest-fame',
      selected: { serverId: 'cain', level: 115 }
    })
    expect(slot.choices?.map((choice) => choice.serverId)).toEqual(['cain', 'siroco', 'hilder'])
    expect(f.image).not.toHaveBeenCalled()
  })

  it('서버 칩으로 고른 조회는 얼굴 관측이 있어도 그 서버로만 찾고 확정으로 둔다', async () => {
    const f = fixture('party')
    await f.observe({ nickname: '못찾음', portrait: face(CONFIDENT_FACE) })

    const slot = await f.lookup({ nickname: TYPED_NAME, serverId: 'hilder' })

    expect(slot).toMatchObject({ selectionMethod: 'manual', selected: { serverId: 'hilder' } })
    expect(slot).not.toHaveProperty('choices')
    expect(f.image).not.toHaveBeenCalled()
  })
})

describe('서버 없이 이름 칸에서 조회한 공대 자리', () => {
  it('그 행에서 읽은 직업명이 한 후보와 맞으면 그 후보로 확정하고 상세까지 채운다', async () => {
    const f = fixture('raid')
    await f.observe({
      nickname: '못찾음',
      portrait: null,
      raidRow: { jobText: '버서커', valueColumn: 'fame', valueText: null }
    })

    const slot = await f.lookup({ nickname: TYPED_NAME })

    expect(slot).toMatchObject({
      selectionMethod: 'job',
      selected: { serverId: 'siroco', level: 115 }
    })
    expect(slot).not.toHaveProperty('choices')
  })

  it('그 행의 명성으로 확정하지 못하면 OCR처럼 명성 추정과 후보를 함께 준다', async () => {
    const f = fixture('raid')
    await f.observe({
      nickname: '못찾음',
      portrait: null,
      raidRow: { jobText: null, valueColumn: 'fame', valueText: '55,000' }
    })

    const slot = await f.lookup({ nickname: TYPED_NAME })

    expect(slot.selectionMethod).toBe('fame')
    expect(slot.choices?.map((choice) => choice.serverId)).toEqual(['cain', 'siroco', 'hilder'])
  })

  it('OCR 관측이 없는 빈 자리는 최고 명성 후보로 고른다', async () => {
    const f = fixture('raid')

    expect(await f.lookup({ nickname: TYPED_NAME })).toMatchObject({
      selectionMethod: 'highest-fame',
      selected: { serverId: 'cain' }
    })
  })
})
