export const seatTableColumns = [
  { label: '자리', width: 64 },
  { label: '캐릭터' },
  { label: '서버', width: 96 },
  { label: '모험단', width: 150 },
  { label: '길드', width: 110 },
  { label: '직업', width: 140 },
  { label: '명성', width: 100, end: true },
  { label: '점수', width: 120, end: true },
  { label: '스냅샷', width: 96 }
] as const

export const SEAT_TABLE_COLUMN_COUNT = seatTableColumns.length
