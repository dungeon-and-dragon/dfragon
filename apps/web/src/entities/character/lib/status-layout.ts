import { statusElementOf } from './character-detail-display'

const REST_FIRST_STAT = '모험가 명성'
const MOVED_TO_REST: readonly string[] = ['HP', 'MP', '물리 방어율', '마법 방어율']
const COMPARED_STATS = [
  ['힘', '지능', '체력', '정신력'],
  ['물리 공격', '마법 공격'],
  ['물리 크리티컬', '마법 크리티컬'],
  ['화속성 강화', '수속성 강화', '명속성 강화', '암속성 강화']
] as const

type ShownStat = Readonly<{ name: string; value: number | string }>

export type StatusLine = ShownStat & Readonly<{ emphasized: boolean }>
export type StatusLayout = Readonly<{ main: StatusLine[]; rest: StatusLine[] }>

function highestOf(stats: readonly ShownStat[], names: readonly string[]): string[] {
  const compared = stats.filter(({ name }) => names.includes(name))
  const values = compared.flatMap(({ value }) => (typeof value === 'number' ? [value] : []))

  if (values.length === 0) {
    return []
  }

  const highest = Math.max(...values)

  return compared.filter(({ value }) => value === highest).map(({ name }) => name)
}

export function toStatusLayout(stats: readonly ShownStat[]): StatusLayout {
  const emphasized = new Set(COMPARED_STATS.flatMap((names) => highestOf(stats, names)))
  const lines = stats.map((stat) => {
    const isEmphasized = emphasized.has(stat.name)

    return { ...stat, emphasized: isEmphasized }
  })

  const elements = lines.filter(({ name }) => statusElementOf(name) !== null)
  const others = lines.filter(({ name }) => statusElementOf(name) === null)
  const restStart = others.findIndex(({ name }) => name === REST_FIRST_STAT)

  if (restStart === -1) {
    return { main: lines, rest: [] }
  }

  const before = others.slice(0, restStart)
  const main = [...before.filter(({ name }) => !MOVED_TO_REST.includes(name)), ...elements]
  const rest = [
    ...before.filter(({ name }) => MOVED_TO_REST.includes(name)),
    ...others.slice(restStart)
  ]

  return { main, rest }
}
