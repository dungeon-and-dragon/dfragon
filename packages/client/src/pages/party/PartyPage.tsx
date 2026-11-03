import * as stylex from '@stylexjs/stylex'
import { useId } from 'react'
import type { SlotCard, SlotCardActions } from '@dfragon/client-core/lib/slot-cards'
import { Seat } from '../../components/Seat'
import { SeatMoveStatus } from '../../components/SeatMoveStatus'
import { SeatTable } from '../../components/SeatTable'
import { useSeatMove } from '../../hooks/useSeatMove'
import type { SeatArrangement } from '../../hooks/useSeatOrder'
import { CharacterRow } from '../../sections/CharacterRow'
import { isBusySlot } from '../../lib/card-presentation'
import { styles } from './PartyPage.style'

export function PartyPage({
  slots,
  resetKey,
  seats,
  actions
}: {
  slots: readonly SlotCard[]
  resetKey: string
  seats: SeatArrangement
  actions: Pick<SlotCardActions, 'lookupSlot' | 'changeSnapshotAdventure'>
}): React.JSX.Element {
  const { seatOrder, canMoveSeats } = seats
  const { lookupSlot, changeSnapshotAdventure } = actions
  const hintId = useId()
  const { moveSeat, notice } = useSeatMove({ resetKey, seats })

  function renderSeat(slot: number, seat: number): React.JSX.Element {
    const handleLookup = (nickname: string, serverId?: string): void =>
      lookupSlot(slot, nickname, serverId)
    const handleChangeSnapshotAdventure = (value: string): void =>
      changeSnapshotAdventure(seat, value)

    return (
      <Seat
        key={`${resetKey}-${slot}`}
        label={`${seat + 1}번 자리`}
        move={moveSeat(seat)}
        busy={isBusySlot(slots[slot])}
        describedBy={canMoveSeats ? hintId : undefined}
      >
        <CharacterRow
          cardKey={{ id: `party-${slot}`, resetKey }}
          card={slots[slot]}
          slot={seat + 1}
          seat={<span {...stylex.props(styles.seat)}>{seat + 1}</span>}
          screen="party"
          onLookup={handleLookup}
          onChangeSnapshotAdventure={handleChangeSnapshotAdventure}
        />
      </Seat>
    )
  }

  return (
    <section aria-label="파티 캐릭터">
      <SeatTable label="파티">{seatOrder.map(renderSeat)}</SeatTable>
      <SeatMoveStatus hintId={hintId} layout={seats.layout} notice={notice} />
    </section>
  )
}
