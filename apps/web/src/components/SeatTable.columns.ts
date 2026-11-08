import { styles } from './SeatTable.style'

export const seatTableColumns = [
  { label: '자리', width: 64, style: styles.first },
  { label: '캐릭터' },
  { label: '서버', width: 96 },
  { label: '모험단', width: 150 },
  { label: '길드', width: 110 },
  { label: '직업', width: 140 },
  { label: '명성', width: 100, style: styles.end },
  { label: '점수', width: 120, style: styles.end },
  { label: '스냅샷', width: 96, style: styles.last }
] as const

export const SEAT_TABLE_COLUMN_COUNT = seatTableColumns.length
