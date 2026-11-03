import { portraitFaceWindowOf } from '../preload/common/search/portrait-anchor'
import type { SelectedCharacterSummary } from '../preload/common/types/character'
import { SEARCH_ERRORS, type SearchError, type SearchSlot } from '../preload/common/types/search'
import { serverNames } from '../constants/servers'
import { MISSING_VALUE } from '../constants/cards'
import type { CardCharacter } from '../types/cards'
import type { SearchMode } from '../types/search-mode'
import type { ServerId } from '../types/servers'

function isServerId(value: string): value is ServerId {
  return Object.hasOwn(serverNames, value)
}

export function toCharacterCard(
  summary: SelectedCharacterSummary | undefined
): CardCharacter | undefined {
  if (summary == null || !isServerId(summary.serverId)) {
    return undefined
  }
  const adventure = summary.adventureName ?? MISSING_VALUE
  const job = summary.jobGrowName ?? summary.jobName ?? MISSING_VALUE

  return {
    characterId: summary.characterId,
    name: summary.characterName,
    adventure,
    job,
    serverId: summary.serverId,
    fame: summary.fame,
    guild: summary.guildName,
    card: summary.card,
    level: summary.level,
    image: summary.imageUrl,
    face: portraitFaceWindowOf(summary.jobName)
  }
}

export type SlotNoticeTone = 'failure' | 'error' | 'estimate'
export type SlotNotice = Readonly<{ text: string; tone: SlotNoticeTone }>

const DETAILS_FAILED =
  '상세 정보를 불러오지 못했습니다. 서버와 이름을 직접 조회하면 다시 불러옵니다.'

function errorText(error: SearchError): string {
  if (error.message !== undefined) {
    return error.message
  }

  return SEARCH_ERRORS[error.code].message
}

function raidSelectionNotice(slot: SearchSlot): string | undefined {
  if (slot.selectionMethod === 'highest-fame') {
    return '직업과 수치 미확인, 최고 명성 후보입니다.'
  }

  if (slot.choices === undefined) {
    return undefined
  }

  if (slot.selectionMethod === 'fame') {
    return '명성으로 추정한 후보입니다.'
  }

  return undefined
}

function failureNotice(slot: SearchSlot): SlotNotice {
  if (slot.error == null) {
    return { text: '캐릭터를 찾지 못함', tone: 'failure' }
  }

  if (slot.error.code === 'INVALID_SEARCH_QUERY' && slot.nickname === '') {
    return { text: '닉네임을 읽지 못했습니다. 직접 입력해 주세요.', tone: 'failure' }
  }

  return { text: errorText(slot.error), tone: 'error' }
}

export function searchSlotNotice(
  slot: SearchSlot,
  screen: SearchMode = 'party'
): SlotNotice | undefined {
  if (slot.state === 'empty') {
    return { text: '캐릭터를 찾지 못함', tone: 'failure' }
  }

  if (slot.state === 'failure') {
    return failureNotice(slot)
  }

  if (slot.details === 'failed') {
    const text = slot.detailsError !== undefined ? errorText(slot.detailsError) : DETAILS_FAILED

    return { text, tone: 'error' }
  }
  const estimate = screen === 'raid' ? raidSelectionNotice(slot) : undefined
  if (estimate !== undefined) {
    return { text: estimate, tone: 'estimate' }
  }

  return undefined
}
