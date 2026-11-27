import type { ActivitySummary } from '#entities/adventure-guild'
import apocalypse from '#shared/assets/clear-content-backgrounds/apocalypse.webp'
import asrahan from '#shared/assets/clear-content-backgrounds/asrahan.webp'
import awakenedForest from '#shared/assets/clear-content-backgrounds/awakened-forest.webp'
import bakal from '#shared/assets/clear-content-backgrounds/bakal.webp'
import darkIsland from '#shared/assets/clear-content-backgrounds/dark-island.webp'
import diregie from '#shared/assets/clear-content-backgrounds/diregie.webp'
import dimensionCorridor from '#shared/assets/clear-content-backgrounds/dimension-corridor.webp'
import anton from '#shared/assets/clear-content-backgrounds/anton.webp'
import gaeBolg from '#shared/assets/clear-content-backgrounds/gae-bolg.webp'
import inae from '#shared/assets/clear-content-backgrounds/inae.webp'
import ispins from '#shared/assets/clear-content-backgrounds/ispins.webp'
import luke from '#shared/assets/clear-content-backgrounds/luke.webp'
import ozma from '#shared/assets/clear-content-backgrounds/ozma.webp'
import preyIsys from '#shared/assets/clear-content-backgrounds/prey-isys.webp'
import sirocco from '#shared/assets/clear-content-backgrounds/sirocco.webp'
import venus from '#shared/assets/clear-content-backgrounds/venus.webp'
import season10 from '#shared/assets/season-raid-backgrounds/season-10.webp'
import season11 from '#shared/assets/season-raid-backgrounds/season-11.webp'
import { useAdventureActivity } from './api/useAdventureActivity'

const TITLE = '이번 시즌 클리어'
const HARD_BADGE = 'badge bg-danger-weak text-fg-danger'
// 깨어난 숲의 극은 레이드 하드와 같은 어려운 단계다.
const HARD_STAGES = new Set(['하드', '극'])
const MUTED_LABEL = 'text-xs font-medium text-fg-muted'
const ROW =
  'relative flex h-12 items-center gap-2 overflow-hidden rounded-control bg-control px-4 whitespace-nowrap'
const SHADE =
  'absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-canvas)_92%,transparent)_0%,color-mix(in_srgb,var(--color-canvas)_50%,transparent)_35%,color-mix(in_srgb,var(--color-canvas)_25%,transparent)_55%,color-mix(in_srgb,var(--color-canvas)_85%,transparent)_75%,color-mix(in_srgb,var(--color-canvas)_92%,transparent)_100%)]'

const numberFormat = new Intl.NumberFormat('ko-KR')

// 레이드와 레기온 이름은 겹치지 않아 이름으로 고른다. 나벨과 미카엘라는 그 레이드가 나온 시즌 배경과 같은 원본이고,
// 아스라한은 안개신 레이드, 기계 혁명은 폭룡왕 바칼 레이드 그림이다.
const BACKGROUNDS = new Map<string, string>([
  ['무너진 성자 미카엘라', season11],
  ['디레지에 레이드', diregie],
  ['이내 황혼전', inae],
  ['만들어진 신 나벨', season10],
  ['아스라한', asrahan],
  ['기계 혁명', bakal],
  ['혼돈의 오즈마', ozma],
  ['무형의 시로코', sirocco],
  ['프레이-이시스', preyIsys],
  ['루크', luke],
  ['안톤', anton],
  ['코드네임 게이볼그', gaeBolg],
  ['아포칼립스', apocalypse],
  ['베누스', venus],
  ['깨어난 숲', awakenedForest],
  ['어둑섬', darkIsland],
  ['차원회랑', dimensionCorridor],
  ['이스핀즈', ispins]
])

const KIND_LABELS = { raid: '레이드', legion: '레기온' } as const

type StageCount = Readonly<{ stage: string | null; count: number }>

type ClearRow = Readonly<{
  key: string
  kind: keyof typeof KIND_LABELS
  name: string
  stages: readonly StageCount[]
}>

// 레기온은 단계 없이 `깨어난 숲(극)`처럼 이름 뒤 괄호에 단계를 적는다.
const LEGION_STAGE = /^(.+)\((극|일반)\)$/

function splitLegionName(name: string): { name: string; stage: string | null } {
  const match = LEGION_STAGE.exec(name)

  if (match === null) {
    return { name, stage: null }
  }

  return { name: match[1]!, stage: match[2]! }
}

// API가 출시 순서와 단계 순서로 정렬해 주므로, 같은 컨텐츠의 단계를 나온 순서대로 한 줄에 모은다.
function toClearRows({ raids, legions }: ActivitySummary): ClearRow[] {
  const rows = new Map<string, ClearRow & { stages: StageCount[] }>()

  function add(kind: ClearRow['kind'], name: string, stage: string | null, count: number): void {
    const key = `${kind}/${name}`
    const row = rows.get(key) ?? { key, kind, name, stages: [] }

    row.stages.push({ stage, count })
    rows.set(key, row)
  }

  for (const { name, raid = name, stage = null, count } of raids) {
    add('raid', raid, stage, count)
  }

  for (const legion of legions) {
    const { name, stage } = splitLegionName(legion.name)
    add('legion', name, stage, legion.count)
  }

  return [...rows.values()]
}

function StageCountItem({ stage, count }: StageCount): React.JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-1">
      {stage !== null && (
        <span className={HARD_STAGES.has(stage) ? HARD_BADGE : MUTED_LABEL}>{stage}</span>
      )}
      <span className="num text-xl font-semibold">{numberFormat.format(count)}</span>
    </span>
  )
}

function ClearRowItem({ row }: { row: ClearRow }): React.JSX.Element {
  const background = BACKGROUNDS.get(row.name)

  return (
    <li className={ROW}>
      {background !== undefined && (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-[center_20%]"
            style={{ backgroundImage: `url("${background}")` }}
          />
          <span aria-hidden="true" className={SHADE} />
        </>
      )}
      <span className={`relative ${MUTED_LABEL}`}>{KIND_LABELS[row.kind]}</span>
      <span className="relative min-w-0 flex-1 truncate font-semibold">{row.name}</span>
      <span className="relative flex items-baseline gap-4">
        {row.stages.map((stage) => (
          <StageCountItem key={stage.stage ?? ''} {...stage} />
        ))}
      </span>
    </li>
  )
}

export function SeasonClears({
  adventureName,
  season
}: {
  adventureName: string
  season: number | undefined
}): React.JSX.Element | null {
  const result = useAdventureActivity(adventureName, season)

  if (result.status !== 'success' || result.previous) {
    return null
  }

  const rows = toClearRows(result.value.summary)

  return (
    <section aria-label={TITLE} className="section min-w-0">
      <h2 className="section-title whitespace-nowrap">
        <span>{TITLE}</span>
        <span className="section-title-count">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="m-0 px-4 py-3 text-fg-subtle">이번 시즌 클리어 기록이 없습니다.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 px-4 py-3">
          {rows.map((row) => (
            <ClearRowItem key={row.key} row={row} />
          ))}
        </ul>
      )}
    </section>
  )
}
