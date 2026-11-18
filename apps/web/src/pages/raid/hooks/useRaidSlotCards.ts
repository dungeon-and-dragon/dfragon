import {
  RAID_PARTY_SIZE,
  seatValuesToSlotOrder,
  slotAdventureName,
  type SlotCard,
  toClipboardText,
  toSlotCards
} from '#core/capture'
import { useAdventureSnapshot } from '#hooks/useAdventureSnapshot'
import type { RaidCapture } from '#hooks/useRaidCapture'

export function useRaidSlotCards(capture: RaidCapture): {
  cards: SlotCard[]
  snapshot: ReturnType<typeof useAdventureSnapshot>
  clipboardText: string
} {
  const { search } = capture
  const { seatOrder } = capture.seats
  const snapshot = useAdventureSnapshot(
    'raid',
    seatOrder.map((slot) => slotAdventureName(search.slots[slot])),
    capture.startedRounds
  )
  const cards = toSlotCards({
    slots: search.slots,
    nicknames: capture.nicknames,
    manualSlots: search.manualSlots,
    recognizing: capture.recognizing,
    snapshotMarks: seatValuesToSlotOrder(seatOrder, snapshot.marks),
    snapshotAdventureInputs: seatValuesToSlotOrder(seatOrder, snapshot.adventureInputs),
    candidatePickers: search.candidatePickers,
    screen: 'raid'
  })
  const clipboardText = toClipboardText({
    slots: search.slots,
    nicknames: capture.nicknames,
    seatOrder,
    rowSize: RAID_PARTY_SIZE
  })

  return { cards, snapshot, clipboardText }
}
