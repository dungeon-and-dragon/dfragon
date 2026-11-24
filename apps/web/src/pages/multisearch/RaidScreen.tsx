import { useId } from 'react'
import {
  filledSlotCount,
  RAID_PARTY_COUNT,
  RAID_PARTY_SIZE,
  type RaidParty,
  type SeatArrangement,
  type SlotCard,
  type SlotCardActions,
  toRaidSeat,
  useSeatMove
} from '#features/capture-search'
import { Seat } from './components/Seat'
import { SeatTable } from './components/SeatTable'
import { SEAT_TABLE_COLUMN_COUNT } from './components/SeatTable.columns'
import { isBusySlot } from './card-presentation'
import { CharacterRow } from './components/CharacterRow'

const parties = Array.from({ length: RAID_PARTY_COUNT }, (_, party) =>
  Array.from({ length: RAID_PARTY_SIZE }, (_, member) => party * RAID_PARTY_SIZE + member)
)

const badgeClass = 'badge badge-sm font-semibold'

const partyClasses: Readonly<Record<RaidParty, string>> = {
  R: 'bg-raid-party-red-weak text-raid-party-red',
  Y: 'bg-raid-party-yellow-weak text-raid-party-yellow',
  G: 'bg-raid-party-green-weak text-raid-party-green'
}

export function RaidScreen({
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
  const id = useId()
  const { moveSeat } = useSeatMove({ resetKey, seats })

  function renderSeat(seat: number, partyLabelId: string): React.JSX.Element {
    const slot = seatOrder[seat]
    const raidSeat = toRaidSeat(seat + 1)
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
        describedBy={partyLabelId}
      >
        <CharacterRow
          cardKey={{ id: `raid-${slot}`, resetKey }}
          card={slots[slot]}
          slot={seat + 1}
          seat={
            <span className={`${badgeClass} ${partyClasses[raidSeat.party]}`}>
              {raidSeat.label}
            </span>
          }
          screen="raid"
          onLookup={handleLookup}
          onPickCandidate={handlePickCandidate}
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
            <tr key={partyLabelId} className="h-8 border-b border-line bg-canvas">
              <td
                id={partyLabelId}
                colSpan={SEAT_TABLE_COLUMN_COUNT}
                className="h-8 px-4 py-0 text-left text-xs font-medium"
              >
                <span className={`${badgeClass} ${partyClasses[partyName]}`}>
                  {`${partyName} 파티`}
                </span>
                <span className="ml-2 num text-fg-subtle">{`${found}/${RAID_PARTY_SIZE}`}</span>
              </td>
            </tr>,
            ...partySeats.map((seat) => renderSeat(seat, partyLabelId))
          ]
        })}
      </SeatTable>
    </section>
  )
}
