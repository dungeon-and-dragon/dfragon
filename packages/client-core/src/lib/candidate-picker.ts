import type { CharacterChoice, SearchSlot } from '../preload/common/types/search'

/**
 * 후보 창에서 누른 후보. 누른 후보의 직접 조회 결과에는 후보 목록이 없으므로, 확정한 뒤에도 칩을 남기려고 누를
 * 때의 후보 목록을 복사해 둔다.
 */
export type CandidatePick = Readonly<{
  choices: readonly CharacterChoice[]
  serverId: string
}>

export type CandidatePicker = Readonly<{
  choices: readonly CharacterChoice[]
  shownServerId: string | null
  picking: CharacterChoice | null
}>

function byFame(choices: readonly CharacterChoice[]): CharacterChoice[] {
  return choices.toSorted((a, b) => (b.fame ?? -Infinity) - (a.fame ?? -Infinity))
}

/** `pick`은 그 슬롯이 아직 이 회차의 직접 조회 상태일 때만 넘긴다. 다음 회차는 OCR 결과로 다시 판정한다. */
export function toCandidatePicker(
  slot: SearchSlot,
  pick: CandidatePick | null
): CandidatePicker | null {
  if (pick !== null) {
    const pending = slot.state === 'pending'
    const picking = pending
      ? (pick.choices.find((choice) => choice.serverId === pick.serverId) ?? null)
      : null
    const shownServerId = pending ? pick.serverId : (slot.selected?.serverId ?? null)

    return { choices: pick.choices, shownServerId, picking }
  }
  const { choices, selected } = slot
  if (choices === undefined || choices.length < 2 || selected === undefined) {
    return null
  }

  const sortedChoices = byFame(choices)

  return { choices: sortedChoices, shownServerId: selected.serverId, picking: null }
}

export function nextCandidatePick(
  picker: CandidatePicker | null,
  serverId: string
): CandidatePick | null {
  const isChoice = picker?.choices.some((choice) => choice.serverId === serverId) === true
  if (picker === null || !isChoice || picker.shownServerId === serverId) {
    return null
  }

  return { choices: picker.choices, serverId }
}
