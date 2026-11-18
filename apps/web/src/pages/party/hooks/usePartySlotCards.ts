import {
  seatValuesToSlotOrder,
  slotAdventureName,
  type SlotCard,
  toClipboardText,
  toSlotCards
} from '#core/capture'
import { useAdventureSnapshot } from '../../../hooks/useAdventureSnapshot'
import type { PartyCapture } from '../../../hooks/usePartyCapture'

export function usePartySlotCards(capture: PartyCapture): {
  cards: SlotCard[]
  snapshot: ReturnType<typeof useAdventureSnapshot>
  clipboardText: string
} {
  const { search } = capture
  const { seatOrder } = capture.seats
  const snapshot = useAdventureSnapshot(
    'party',
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
    candidatePickers: search.candidatePickers
  })
  const clipboardText = toClipboardText({
    slots: search.slots,
    nicknames: capture.nicknames,
    seatOrder,
    rowSize: search.slots.length
  })

  return { cards, snapshot, clipboardText }
}
