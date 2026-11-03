import * as stylex from '@stylexjs/stylex'
import { RAID_PARTY_SIZE } from '@dfragon/client-core/constants/cards'
import type { SnapshotMark } from '@dfragon/client-core/lib/adventure-snapshot'
import type { SearchMode } from '@dfragon/client-core/types/search-mode'
import { SnapshotIcon } from './SnapshotIcon'
import { styles } from './SnapshotBadge.style'

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
        {...stylex.props(styles.badge, styles.absent)}
      >
        <SnapshotIcon filled width={10} height={10} />
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
      {...stylex.props(styles.badge, styles.order, mark.kind === 'moved' && styles.moved)}
    >
      <SnapshotIcon filled width={10} height={10} />
      <span aria-hidden="true">{order}</span>
    </span>
  )
}
