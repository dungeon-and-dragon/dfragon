import {
  type CharacterCard,
  type CharacterTier,
  type SearchMode,
  type SlotCard,
  type SnapshotMark,
  toCandidatePicker,
  toSlotCards
} from '#core/capture'
import type { SelectedCharacterSummary } from '#core/character'
import type { CharacterChoice, SearchSlot, SearchSnapshot } from '#core/search'
import { bufferCard, CAPTURE_ID, dealerCard } from '#core/testing'
import type { BrowserHost } from '#host/client-host'
import characterImage from '#testing/fixtures/mvp/assets/character.png'
import { createStoryClientHost } from './story-host'

// 멀티서치 표에 넣을 검색 결과와 행 값이다. 이름, 소속은 실제 캐릭터가 아닌 합성 값이다.

const SERVERS = [
  ['cain', '카인'],
  ['siroco', '시로코'],
  ['bakal', '바칼'],
  ['hilder', '힐더']
] as const

const JOBS = [
  ['귀검사(남)', '眞 웨펀마스터', 'dealer'],
  ['마법사(여)', '眞 인챈트리스', 'buffer'],
  ['거너(여)', '眞 레인저', 'dealer'],
  ['프리스트(남)', '眞 크루세이더', 'buffer'],
  ['격투가(남)', '眞 스트라이커', 'dealer'],
  ['마법사(남)', '眞 엘레멘탈 바머', 'dealer']
] as const

function scoredCard(base: CharacterCard, value: number): CharacterCard {
  if (base.score == null) {
    return base
  }

  return { ...base, score: { ...base.score, value } }
}

function storySelected(index: number): SelectedCharacterSummary {
  const number = index + 1
  const [serverId, serverName] = SERVERS[index % SERVERS.length]!
  const [jobName, jobGrowName, role] = JOBS[index % JOBS.length]!
  const base = role === 'buffer' ? bufferCard : dealerCard
  const score = role === 'buffer' ? 55_358 - index * 310 : 414_806 - index * 4210
  const guildless = index % 5 === 4
  const characterId = `story-character-${number}`
  const characterName = `캐릭터${number}`
  const adventureName = `모험단${(index % 3) + 1}`
  const fame = 138_960 - index * 1730
  const card = scoredCard(base, score)
  const guildId = guildless ? null : `guild-${(index % 2) + 1}`
  const guildName = guildless ? null : `길드${(index % 2) + 1}`

  return {
    serverId,
    characterId,
    characterName,
    serverName,
    adventureName,
    jobName,
    jobGrowName,
    level: 115,
    fame,
    imageUrl: characterImage,
    guildId,
    guildName,
    equipmentScore: null,
    card
  }
}

function idleSlot(slot: number): SearchSlot {
  return {
    slot,
    observationRevision: 0,
    requestId: null,
    nickname: null,
    state: 'idle',
    rows: [],
    error: null
  }
}

function requestedSlot(slot: number): Omit<SearchSlot, 'state'> {
  const idle = idleSlot(slot)
  const requestId = `story-request-${slot}`

  return { ...idle, observationRevision: 1, requestId }
}

function foundSlot(slot: number, index = slot): SearchSlot {
  const selected = storySelected(index)
  const { characterId, characterName, serverId, serverName, fame } = selected

  const requested = requestedSlot(slot)

  return {
    ...requested,
    nickname: characterName,
    state: 'success',
    rows: [{ characterId, characterName, serverId, serverName, fame }],
    selected
  }
}

function emptySlot(slot: number): SearchSlot {
  const requested = requestedSlot(slot)
  const nickname = `캐릭터${slot + 1}`

  return { ...requested, nickname, state: 'empty' }
}

function pendingSlot(slot: number): SearchSlot {
  const requested = requestedSlot(slot)
  const nickname = `캐릭터${slot + 1}`

  return { ...requested, nickname, state: 'pending' }
}

function candidateSlot(slot: number): SearchSlot {
  const found = foundSlot(slot)
  const name = found.selected!.characterName
  const choices: CharacterChoice[] = SERVERS.map(([serverId, serverName], index) => {
    const characterId = `story-candidate-${index + 1}`
    const fame = index === 3 ? null : 131_204 - index * 9850
    const adventureName = index % 2 === 0 ? `모험단${index + 4}` : null

    return { characterId, characterName: name, serverId, serverName, fame, adventureName }
  })
  const shown = choices[0]!

  return {
    ...found,
    rows: choices,
    choices,
    selected: { ...found.selected!, characterId: shown.characterId, fame: shown.fame }
  }
}

function snapshot(slots: SearchSlot[]): SearchSnapshot {
  return { revision: 1, captureId: CAPTURE_ID, slots }
}

const storyPartySnapshot = snapshot([foundSlot(0), candidateSlot(1), emptySlot(2), pendingSlot(3)])

const storyRaidSnapshot = snapshot(
  Array.from({ length: 12 }, (_, slot) => {
    if (slot === 6) {
      return emptySlot(slot)
    }

    if (slot === 11) {
      return idleSlot(slot)
    }

    return foundSlot(slot)
  })
)

function withTiers(cards: SlotCard[], tiers: Readonly<Record<number, CharacterTier>>): SlotCard[] {
  return cards.map((card, slot) => {
    const tier = tiers[slot]
    if (tier === undefined || card.character === undefined) {
      return card
    }

    return { ...card, character: { ...card.character, tier } }
  })
}

// 검색 회차를 돌리지 않고 표를 그리도록 검색 결과를 화면의 행 값으로 바꾼다. 상위, 랭커 표시는 검색 결과에 없어
// 행 값에 더한다.
function storySlotCards({
  snapshot,
  screen,
  snapshotMarks,
  tiers
}: {
  snapshot: SearchSnapshot
  screen: SearchMode
  snapshotMarks: readonly (SnapshotMark | undefined)[]
  tiers: Readonly<Record<number, CharacterTier>>
}): SlotCard[] {
  const { slots } = snapshot
  const nicknames = slots.map((slot) => slot.nickname)
  const manualSlots = slots.map(() => false)
  const snapshotAdventureInputs = slots.map(() => undefined)
  const candidatePickers = slots.map((slot) => toCandidatePicker(slot, null))
  const cards = toSlotCards({
    slots,
    nicknames,
    manualSlots,
    recognizing: false,
    snapshotMarks,
    snapshotAdventureInputs,
    candidatePickers,
    screen
  })

  return withTiers(cards, tiers)
}

export const storyPartyCards = storySlotCards({
  snapshot: storyPartySnapshot,
  screen: 'party',
  snapshotMarks: [
    { kind: 'kept', seat: 1 },
    { kind: 'moved', seat: 4 }
  ],
  tiers: { 0: 'ranker' }
})

export const storyRaidCards = storySlotCards({
  snapshot: storyRaidSnapshot,
  screen: 'raid',
  snapshotMarks: [
    { kind: 'kept', seat: 1 },
    { kind: 'kept', seat: 2 },
    { kind: 'moved', seat: 6 },
    { kind: 'absent' }
  ],
  tiers: { 1: 'top', 4: 'ranker' }
})

function unsubscribe(): void {}

// 화면 공유, 붙여넣기, 자동 인식은 story에서 일어나지 않으므로 공유 요청은 받는 중으로 두고 구독은 아무것도 하지 않는다.
export function createStoryMultisearchHost(): BrowserHost {
  const host = createStoryClientHost()

  return {
    ...host,
    onPastedFrame: () => unsubscribe,
    requestScreenShare: () => new Promise<string | null>(() => {}),
    onScreenShareEnded: () => unsubscribe,
    setWatchedScreen: () => {},
    onAutoRound: () => unsubscribe
  }
}
