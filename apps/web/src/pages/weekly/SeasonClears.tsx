import type { ActivitySummary } from '#entities/adventure-guild'
import apocalypse from '#shared/assets/clear-content-backgrounds/apocalypse.webp'
import diregie from '#shared/assets/clear-content-backgrounds/diregie.webp'
import inae from '#shared/assets/clear-content-backgrounds/inae.webp'
import venus from '#shared/assets/clear-content-backgrounds/venus.webp'
import season10 from '#shared/assets/season-raid-backgrounds/season-10.webp'
import season11 from '#shared/assets/season-raid-backgrounds/season-11.webp'
import { useAdventureActivity } from './api/useAdventureActivity'

const TITLE = '이번 시즌 클리어'
const HARD_BADGE = 'badge bg-danger-weak text-fg-danger'
const MUTED_LABEL = 'text-xs font-medium text-fg-muted'
const ROW =
  'relative flex h-12 items-center gap-2 overflow-hidden rounded-control bg-control px-4 whitespace-nowrap'
const SHADE =
  'absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-canvas)_92%,transparent)_0%,color-mix(in_srgb,var(--color-canvas)_50%,transparent)_35%,color-mix(in_srgb,var(--color-canvas)_25%,transparent)_55%,color-mix(in_srgb,var(--color-canvas)_85%,transparent)_75%,color-mix(in_srgb,var(--color-canvas)_92%,transparent)_100%)]'

const numberFormat = new Intl.NumberFormat('ko-KR')

// 클리어 통계 카드와 같은 그림이다. 나벨과 미카엘라는 그 레이드가 나온 시즌 배경과 같은 원본이다.
const BACKGROUNDS = new Map<string, string>([
  ['raid/만들어진 신 나벨', season10],
  ['raid/이내 황혼전', inae],
  ['raid/디레지에 레이드', diregie],
  ['raid/무너진 성자 미카엘라', season11],
  ['legion/아포칼립스', apocalypse],
  ['legion/베누스', venus]
])

const KIND_LABELS = { raid: '레이드', legion: '레기온' } as const

type StageCount = Readonly<{ stage: string | null; count: number }>

type ClearRow = Readonly<{
  key: string
  kind: keyof typeof KIND_LABELS
  name: string
  stages: readonly StageCount[]
}>

// 레이드 목록은 API가 출시 순서와 단계 순서로 정렬해 주므로, 같은 레이드의 단계를 나온 순서대로 한 줄에 모은다.
function toClearRows({ raids, legions }: ActivitySummary): ClearRow[] {
  const rows = new Map<string, ClearRow & { stages: StageCount[] }>()

  for (const { name, raid = name, stage = null, count } of raids) {
    const key = `raid/${raid}`
    const row = rows.get(key) ?? { key, kind: 'raid', name: raid, stages: [] }

    row.stages.push({ stage, count })
    rows.set(key, row)
  }

  const legionRows = legions.map(
    ({ name, count }): ClearRow => ({
      key: `legion/${name}`,
      kind: 'legion',
      name,
      stages: [{ stage: null, count }]
    })
  )

  return [...rows.values(), ...legionRows]
}

function StageCountItem({ stage, count }: StageCount): React.JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-1">
      {stage !== null && (
        <span className={stage === '하드' ? HARD_BADGE : MUTED_LABEL}>{stage}</span>
      )}
      <span className="num text-xl font-semibold">{numberFormat.format(count)}</span>
    </span>
  )
}

function ClearRowItem({ row }: { row: ClearRow }): React.JSX.Element {
  const background = BACKGROUNDS.get(row.key)

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
