import { ChevronDownIcon } from '@dfragon/ui'
import { useRef, useState } from 'react'
import type { ActivitySummary } from '#entities/adventure-guild'
import anton from '#shared/assets/clear-content-backgrounds/anton.webp'
import apocalypse from '#shared/assets/clear-content-backgrounds/apocalypse.webp'
import asrahan from '#shared/assets/clear-content-backgrounds/asrahan.webp'
import awakenedForest from '#shared/assets/clear-content-backgrounds/awakened-forest.webp'
import darkIsland from '#shared/assets/clear-content-backgrounds/dark-island.webp'
import dimensionCorridor from '#shared/assets/clear-content-backgrounds/dimension-corridor.webp'
import diregie from '#shared/assets/clear-content-backgrounds/diregie.webp'
import gaeBolg from '#shared/assets/clear-content-backgrounds/gae-bolg.webp'
import inae from '#shared/assets/clear-content-backgrounds/inae.webp'
import ispins from '#shared/assets/clear-content-backgrounds/ispins.webp'
import luke from '#shared/assets/clear-content-backgrounds/luke.webp'
import sirocco from '#shared/assets/clear-content-backgrounds/sirocco.webp'
import venus from '#shared/assets/clear-content-backgrounds/venus.webp'
import season6 from '#shared/assets/season-raid-backgrounds/season-6.webp'
import season7 from '#shared/assets/season-raid-backgrounds/season-7.webp'
import season8 from '#shared/assets/season-raid-backgrounds/season-8.webp'
import season10 from '#shared/assets/season-raid-backgrounds/season-10.webp'
import season11 from '#shared/assets/season-raid-backgrounds/season-11.webp'
import { useArrowNudge } from './animations/useArrowNudge'
import { useAdventureActivity } from './api/useAdventureActivity'

const HARD_BADGE = 'badge bg-danger-weak text-fg-danger'
// 깨어난 숲의 극은 레이드 하드와 같은 어려운 단계다.
const HARD_STAGES = new Set(['하드', '극'])
const MUTED_LABEL = 'text-xs font-medium text-fg-muted'
const ROW =
  'relative flex h-12 items-center gap-2 overflow-hidden rounded-control bg-control px-4 whitespace-nowrap'
const SHADE =
  'absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-canvas)_95%,transparent)_0%,color-mix(in_srgb,var(--color-canvas)_70%,transparent)_35%,color-mix(in_srgb,var(--color-canvas)_50%,transparent)_55%,color-mix(in_srgb,var(--color-canvas)_90%,transparent)_75%,color-mix(in_srgb,var(--color-canvas)_95%,transparent)_100%)]'

const numberFormat = new Intl.NumberFormat('ko-KR')

// 레이드와 레기온 이름은 겹치지 않아 이름으로 고른다. 미카엘라, 나벨, 기계 혁명(폭룡왕 바칼), 혼돈의 오즈마,
// 프레이-이시스는 그 레이드가 나온 시즌 배경과 같은 원본이고, 아스라한은 안개신 레이드 그림이다.
const BACKGROUNDS = new Map<string, string>([
  ['무너진 성자 미카엘라', season11],
  ['디레지에 레이드', diregie],
  ['이내 황혼전', inae],
  ['만들어진 신 나벨', season10],
  ['아스라한', asrahan],
  ['기계 혁명', season8],
  ['혼돈의 오즈마', season7],
  ['무형의 시로코', sirocco],
  ['프레이-이시스', season6],
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

// 운영 DB 클리어 기록(code 201, 209, 210)에서 그 이름이 처음 나온 날이다(2026-11-28). 루크와 안톤은 Neople이
// 타임라인을 주는 첫날 다음 날이라 실제 출시는 더 앞이다. 고른 시즌 시작 전에 나온 컨텐츠를 지난 시즌 컨텐츠로 본다.
const RELEASED_AT = new Map<string, number>(
  [
    ['무너진 성자 미카엘라', '2026-08-06'],
    ['아포칼립스', '2026-04-23'],
    ['디레지에 레이드', '2025-12-04'],
    ['이내 황혼전', '2025-08-21'],
    ['만들어진 신 나벨', '2025-04-17'],
    ['베누스', '2025-02-06'],
    ['깨어난 숲', '2024-07-18'],
    ['아스라한', '2024-02-22'],
    ['어둑섬', '2023-11-09'],
    ['차원회랑', '2022-12-29'],
    ['기계 혁명', '2022-09-22'],
    ['이스핀즈', '2022-07-07'],
    ['혼돈의 오즈마', '2021-05-27'],
    ['무형의 시로코', '2020-05-14'],
    ['프레이-이시스', '2019-02-14'],
    ['루크', '2017-09-22'],
    ['안톤', '2017-09-22']
  ].map(([name, date]) => [name!, Date.parse(`${date}T00:00:00+09:00`)])
)

const KIND_LABELS = { raid: '레이드', legion: '레기온' } as const

const PAST_TOGGLE =
  'inline-flex size-[36px] cursor-pointer items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg focus-ring'

// 단계마다 칸을 정해 줄이 달라도 같은 단계가 세로로 맞는다. 단계가 없는 횟수는 맨 오른쪽 칸에 둔다.
// 횟수는 네 자리(쉼표까지 5글자)까지 들어온다고 보고 숫자 칸 폭을 정해 라벨도 세로로 맞춘다.
const STAGE_SLOTS = [0, 1, 2] as const
const STAGE_SLOT = 'flex w-[136px] justify-end max-sm:w-[64px]'

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

function isPastSeasonContent({ name }: ClearRow, seasonStartsAt: number): boolean {
  const releasedAt = RELEASED_AT.get(name)

  return releasedAt !== undefined && releasedAt < seasonStartsAt
}

function stageSlotOf(stage: string | null): number {
  if (stage !== null && HARD_STAGES.has(stage)) {
    return 0
  }

  if (stage === '일반') {
    return 1
  }

  return 2
}

function StageCountItem({ stage, count }: StageCount): React.JSX.Element {
  const label = stage ?? '클리어'

  return (
    <span className="inline-flex items-baseline gap-1 max-sm:flex-col max-sm:items-end max-sm:gap-0">
      <span className={HARD_STAGES.has(label) ? HARD_BADGE : MUTED_LABEL}>{label}</span>
      <span className="num inline-block min-w-[5ch] text-right text-xl font-semibold max-sm:text-base">
        {numberFormat.format(count)}
      </span>
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
      <span className={`relative ${MUTED_LABEL} max-sm:hidden`}>{KIND_LABELS[row.kind]}</span>
      <span className="relative min-w-0 flex-1 truncate font-semibold">{row.name}</span>
      <span className="relative flex items-baseline">
        {STAGE_SLOTS.map((slot) => {
          const stage = row.stages.find(({ stage }) => stageSlotOf(stage) === slot)

          if (stage === undefined) {
            return <span key={slot} aria-hidden="true" className={STAGE_SLOT} />
          }

          return (
            <span key={slot} className={STAGE_SLOT}>
              <StageCountItem {...stage} />
            </span>
          )
        })}
      </span>
    </li>
  )
}

function PastContentToggle({
  count,
  shown,
  onToggle
}: {
  count: number
  shown: boolean
  onToggle: () => void
}): React.JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const arrowRef = useRef<HTMLSpanElement>(null)

  useArrowNudge(buttonRef, arrowRef, shown ? -1 : 1)

  return (
    <div className="flex justify-center px-4 pb-3">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={shown}
        aria-label={shown ? '지난 시즌 컨텐츠 접기' : `지난 시즌 컨텐츠 ${count}개 보기`}
        onClick={onToggle}
        className={PAST_TOGGLE}
      >
        <span ref={arrowRef} className="inline-flex">
          <ChevronDownIcon className={`size-icon-sm ${shown ? 'rotate-180' : ''}`} />
        </span>
      </button>
    </div>
  )
}

export function SeasonClears({
  adventureName,
  season
}: {
  adventureName: string
  season: number | undefined
}): React.JSX.Element | null {
  const [showsPast, setShowsPast] = useState(false)
  const result = useAdventureActivity(adventureName, season)

  if (result.status !== 'success' || result.previous) {
    return null
  }

  const { summary, season: range } = result.value
  const rows = toClearRows(summary)
  const seasonStartsAt = range !== null ? Date.parse(range.startsAt) : Number.NEGATIVE_INFINITY
  const pastCount = rows.filter((row) => isPastSeasonContent(row, seasonStartsAt)).length
  const shownRows = showsPast
    ? rows
    : rows.filter((row) => !isPastSeasonContent(row, seasonStartsAt))

  function togglePast(): void {
    setShowsPast((shows) => !shows)
  }

  return (
    <section aria-label="시즌 클리어" className="section min-w-0">
      {rows.length === 0 && <p className="m-0 px-4 py-3 text-fg-subtle">클리어 기록이 없습니다.</p>}
      {shownRows.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 px-4 py-3">
          {shownRows.map((row) => (
            <ClearRowItem key={row.key} row={row} />
          ))}
        </ul>
      )}
      {pastCount > 0 && (
        <PastContentToggle count={pastCount} shown={showsPast} onToggle={togglePast} />
      )}
    </section>
  )
}
