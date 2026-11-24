import {
  type SeatArrangement,
  type SlotCard,
  type SlotCardActions,
  useSeatMove
} from '#features/capture-search'
import { Seat } from './components/Seat'
import { SeatTable } from './components/SeatTable'
import { CharacterRow } from './components/CharacterRow'
import { isBusySlot } from './card-presentation'

export function PartyScreen({
  slots,
  resetKey,
  seats,
  actions
}: {
  slots: readonly SlotCard[]
  resetKey: string
  seats: SeatArrangement
  actions: SlotCardActions
}): React.JSX.Element {
  const { seatOrder } = seats
  const { lookupSlot, pickCandidate, changeSnapshotAdventure } = actions
  const { moveSeat } = useSeatMove({ resetKey, seats })

  function renderSeat(slot: number, seat: number): React.JSX.Element {
    const handleLookup = (nickname: string, serverId?: string): void =>
      lookupSlot(slot, nickname, serverId)
    const handlePickCandidate = (serverId: string): void => pickCandidate(slot, serverId)
    const handleChangeSnapshotAdventure = (value: string): void =>
      changeSnapshotAdventure(seat, value)

    return (
      <Seat
        key={`${resetKey}-${slot}`}
        label={`${seat + 1}번 자리`}
        move={moveSeat(seat)}
        busy={isBusySlot(slots[slot])}
      >
        <CharacterRow
          cardKey={{ id: `party-${slot}`, resetKey }}
          card={slots[slot]}
          slot={seat + 1}
          seat={<span className="num text-fg-subtle">{seat + 1}</span>}
          screen="party"
          onLookup={handleLookup}
          onPickCandidate={handlePickCandidate}
          onChangeSnapshotAdventure={handleChangeSnapshotAdventure}
        />
      </Seat>
    )
  }

  return (
    <section aria-label="파티 캐릭터">
      <SeatTable label="파티">{seatOrder.map(renderSeat)}</SeatTable>
    </section>
  )
}
