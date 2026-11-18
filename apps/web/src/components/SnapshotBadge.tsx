import { PinIcon } from '@dfragon/ui'
import { RAID_PARTY_SIZE } from '#core/capture/cards'
import type { SnapshotMark } from '#core/capture/adventure-snapshot'
import type { SearchMode } from '#core/capture/search-mode'

const badgeClass = 'badge badge-sm gap-1 border font-semibold'

function seatOrderLabel(seat: number, screen: SearchMode): string {
  if (screen === 'party') {
    return String(seat)
  }
  const index = seat - 1

  return `${Math.floor(index / RAID_PARTY_SIZE) + 1}-${(index % RAID_PARTY_SIZE) + 1}`
}

export function SnapshotBadge({
  mark,
  screen
}: {
  mark: SnapshotMark
  screen: SearchMode
}): React.JSX.Element {
  if (mark.kind === 'absent') {
    return (
      <span
        role="img"
        aria-label="스냅샷에 없는 모험단"
        className={`${badgeClass} border-current text-fg-danger`}
      >
        <PinIcon filled className="size-icon-sm" />
        <span aria-hidden="true">없음</span>
      </span>
    )
  }
  const order = seatOrderLabel(mark.seat, screen)
  const label = mark.kind === 'moved' ? `스냅샷 순번 ${order}, 자리 바뀜` : `스냅샷 순번 ${order}`

  return (
    <span
      role="img"
      aria-label={label}
      className={`${badgeClass} num ${mark.kind === 'moved' ? 'border-signal bg-signal text-on-signal' : 'border-current text-signal'}`}
    >
      <PinIcon filled className="size-icon-sm" />
      <span aria-hidden="true">{order}</span>
    </span>
  )
}
