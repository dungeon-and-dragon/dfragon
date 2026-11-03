import * as stylex from '@stylexjs/stylex'
import { useId } from 'react'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '@dfragon/client-core/constants/cards'
import { type RaidParty, toRaidSeat } from '@dfragon/client-core/lib/raid-seat'
import {
  filledSlotCount,
  type SlotCard,
  type SlotCardActions
} from '@dfragon/client-core/lib/slot-cards'
import { Seat } from '../../components/Seat'
import { SeatMoveStatus } from '../../components/SeatMoveStatus'
import { SeatTable } from '../../components/SeatTable'
import { SEAT_TABLE_COLUMN_COUNT } from '../../components/SeatTable.columns'
import { useSeatMove } from '../../hooks/useSeatMove'
import type { SeatArrangement } from '../../hooks/useSeatOrder'
import { isBusySlot } from '../../lib/card-presentation'
import { CharacterRow } from '../../sections/CharacterRow'
import { styles } from './RaidPage.style'

const parties = Array.from({ length: RAID_PARTY_COUNT }, (_, party) =>
  Array.from({ length: RAID_PARTY_SIZE }, (_, member) => party * RAID_PARTY_SIZE + member)
)

const partyStyles: Readonly<Record<RaidParty, stylex.StyleXStyles>> = {
  R: styles.red,
  Y: styles.yellow,
  G: styles.green
}

export function RaidPage({
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
  const id = useId()
  const { moveSeat, notice } = useSeatMove({ resetKey, seats })
  const hintId = `${id}-move-hint`

  function renderSeat(seat: number, partyLabelId: string): React.JSX.Element {
    const slot = seatOrder[seat]
    const raidSeat = toRaidSeat(seat + 1)
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
        describedBy={canMoveSeats ? `${partyLabelId} ${hintId}` : partyLabelId}
      >
        <CharacterRow
          cardKey={{ id: `raid-${slot}`, resetKey }}
          card={slots[slot]}
          slot={seat + 1}
          seat={
            <span {...stylex.props(styles.badge, partyStyles[raidSeat.party])}>
              {raidSeat.label}
            </span>
          }
          screen="raid"
          onLookup={handleLookup}
          onChangeSnapshotAdventure={handleChangeSnapshotAdventure}
        />
      </Seat>
    )
  }

  return (
    <section aria-label="공대">
      <SeatTable label="공대">
        {parties.flatMap((partySeats, party) => {
          // 파티 헤더 행과 자리 행을 한 tbody에 펼쳐 다른 파티와 맞바꿔도 행이 다시 그려지지 않고 옮겨 간다.
          // 한 tbody 안의 scope="rowgroup" 헤더는 뒤 파티의 행까지 덮으므로, 파티 이름은 칸 대신 행의
          // aria-describedby로 잇는다.
          const partyLabelId = `${id}-party-${party + 1}`
          const { party: partyName } = toRaidSeat(partySeats[0] + 1)
          const found = filledSlotCount(partySeats.map((seat) => slots[seatOrder[seat]]))

          return [
            <tr key={partyLabelId} {...stylex.props(styles.partyRow)}>
              <td
                id={partyLabelId}
                colSpan={SEAT_TABLE_COLUMN_COUNT}
                {...stylex.props(styles.partyCell)}
              >
                <span {...stylex.props(styles.badge, partyStyles[partyName])}>
                  {`${partyName} 파티`}
                </span>
                <span {...stylex.props(styles.count)}>{`${found}/${RAID_PARTY_SIZE}`}</span>
              </td>
            </tr>,
            ...partySeats.map((seat) => renderSeat(seat, partyLabelId))
          ]
        })}
      </SeatTable>
      <SeatMoveStatus hintId={hintId} layout={seats.layout} notice={notice} />
    </section>
  )
}
