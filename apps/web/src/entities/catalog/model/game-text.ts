import { z } from 'zod'

const GAME_TEXT_TONES = [
  'default',
  'increase',
  'decrease',
  'amplify',
  'enhance',
  'refine',
  'set',
  'disabled',
  'rarity-rare',
  'rarity-unique',
  'rarity-epic',
  'rarity-legendary',
  'rarity-chronicle',
  'rarity-primordial'
] as const

export type GameTextTone = (typeof GAME_TEXT_TONES)[number]

// 데이터 묶음이 이 화면보다 먼저 새 tone을 쓰기 시작해도 묶음 전체를 버리지 않도록 기본 색으로 받는다.
const toneSchema = z.string().pipe(z.enum(GAME_TEXT_TONES).catch('default'))

const segmentSchema = z.object({ text: z.string(), tone: toneSchema })

export const gameTextSchema = z.array(z.array(segmentSchema))

export type GameTextLines = z.infer<typeof gameTextSchema>
