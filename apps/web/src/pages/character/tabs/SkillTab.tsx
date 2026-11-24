import { useState } from 'react'
import {
  type CharacterDetailView,
  isMaleCrusaderJob,
  type MaleCrusaderRole,
  maleCrusaderRoleOf
} from '#entities/character'
import { type SkillStats, type SkillStatsJob, useSkillStats } from '#entities/ranking'
import {
  type LearnedSkillRow,
  learnedSkillRowsOf,
  type SkillStyle,
  type SkillUpgrade,
  type SkillWindow,
  type SkillWindowCatalog,
  skillChainOf,
  skillUpgradeBoardOf,
  skillUpgradesOf,
  skillWindowOf,
  useSkillWindowCatalog
} from '#entities/catalog'
import {
  type SkillAdoptionSource,
  SkillChainSection,
  SkillUpgradeSections,
  SkillWindowGrid
} from '#widgets/skill-window'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { LoadingLine } from '#shared/ui/LoadingLine'
import type { CharacterTabProps } from './character-tab-props'
import { detailTabClasses as layout } from './detail-tab-classes'
import { SkillTreeCode } from './skill/SkillTreeCode'

const LIST = 'm-0 flex list-none flex-col gap-1 p-0'
const LIST_ROW = 'flex items-baseline justify-between gap-2'
const SUBTLE = 'whitespace-nowrap text-fg-subtle'
// 스킬 창 최소 폭(테두리 포함 522px)에 왼쪽 열 여백과 오른쪽 340px 열을 더한 896px보다 탭이 좁으면 오른쪽 열을 아래로 내린다.
const ROOT =
  'grid grid-cols-[minmax(max-content,1fr)_340px] divide-x divide-line text-sm @max-[56rem]:grid-cols-1 @max-[56rem]:divide-x-0 @max-[56rem]:divide-y @max-[56rem]:overflow-x-auto'

function LearnedSkillRows({ rows }: { rows: readonly LearnedSkillRow[] }): React.JSX.Element {
  return (
    <div aria-label="배운 스킬" className="flex min-w-0 flex-col gap-4 justify-self-start">
      {rows.map(({ requiredLevel, skills }) => (
        <section key={requiredLevel ?? 'none'} className={layout.section}>
          <h3 className={layout.heading}>
            {requiredLevel !== null ? `${requiredLevel}레벨` : '습득 레벨 없음'}
          </h3>
          <ul className={LIST}>
            {skills.map((skill, index) => (
              <li key={skill.skillId ?? index} className={LIST_ROW}>
                <span>{skill.name}</span>
                {skill.level !== null && (
                  <span className={`${SUBTLE} num select-none`}>{`Lv ${skill.level}`}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function SkillUpgrades({
  label,
  upgrades
}: {
  label: string
  upgrades: readonly SkillUpgrade[]
}): React.JSX.Element | null {
  if (upgrades.length === 0) {
    return null
  }

  return (
    <section aria-label={label} className={layout.section}>
      <h3 className={layout.heading}>{label}</h3>
      <ul className={LIST}>
        {upgrades.map((upgrade, index) => (
          <li key={upgrade.skillId ?? index} className={LIST_ROW}>
            <span>{upgrade.name ?? upgrade.skillId}</span>
            <span className={`${SUBTLE} num`}>{upgrade.type}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function loadedCatalog(
  catalog: LoadedResult<SkillWindowCatalog | null>
): SkillWindowCatalog | null {
  if (catalog.status !== 'success') {
    return null
  }

  return catalog.value
}

function skillStatsJobOf({ character, card }: CharacterDetailView): SkillStatsJob | null {
  const { jobId, jobGrowId } = character

  if (jobId === null || jobGrowId === null) {
    return null
  }

  const role = isMaleCrusaderJob({ jobId, jobGrowId })
    ? maleCrusaderRoleOf(character, card?.role ?? null)
    : null

  return { jobId, jobGrowId, role }
}

function SkillSideColumn({
  detail,
  style,
  catalog,
  source
}: CharacterTabProps & {
  style: SkillStyle
  catalog: SkillWindowCatalog | null
  source: SkillAdoptionSource | null
}): React.JSX.Element {
  const hash = detail.skillStyle?.hash ?? null
  const board = catalog !== null ? skillUpgradeBoardOf(catalog, detail.character, style) : null

  return (
    <div className="min-w-0">
      {hash !== null && <SkillTreeCode hash={hash} />}
      <SkillChainSection chain={skillChainOf(catalog, detail.character, style)} />
      {board !== null && source !== null ? (
        <SkillUpgradeSections board={board} source={source} />
      ) : (
        <div className="flex flex-col gap-6 p-4">
          <SkillUpgrades label="스킬 개화" upgrades={skillUpgradesOf(style, 'evolution')} />
          <SkillUpgrades label="스킬 강화" upgrades={skillUpgradesOf(style, 'enhancement')} />
        </div>
      )}
    </div>
  )
}

type SkillColumnsProps = CharacterTabProps & {
  style: SkillStyle
  catalog: SkillWindowCatalog | null
  skillWindow: SkillWindow | null
}

function SkillColumns({
  detail,
  style,
  catalog,
  skillWindow,
  stats,
  role
}: SkillColumnsProps & {
  stats: SkillStats | null
  role: MaleCrusaderRole | null
}): React.JSX.Element {
  const [now] = useState(Date.now)
  const source = catalog !== null ? { stats, role, marks: catalog.marks, now } : null

  return (
    <div className="@container">
      <div className={ROOT}>
        <div className="p-4">
          {skillWindow !== null && source !== null ? (
            <SkillWindowGrid skillWindow={skillWindow} source={source} />
          ) : (
            <LearnedSkillRows rows={learnedSkillRowsOf([...style.active, ...style.passive])} />
          )}
        </div>
        <SkillSideColumn detail={detail} style={style} catalog={catalog} source={source} />
      </div>
    </div>
  )
}

function SkillColumnsWithStats({
  job,
  ...props
}: SkillColumnsProps & { job: SkillStatsJob }): React.JSX.Element {
  const stats = useSkillStats(job)

  return (
    <SkillColumns
      {...props}
      stats={stats.status === 'success' ? stats.value : null}
      role={job.role}
    />
  )
}

export function SkillTab({ detail }: CharacterTabProps): React.JSX.Element | null {
  const catalog = useSkillWindowCatalog(detail.character.jobName)
  const style = detail.skillStyle?.style
  if (style == null) {
    return null
  }

  if (catalog.status === 'loading') {
    return (
      <div aria-busy="true" className="state state-pending">
        <LoadingLine />
        <span role="status">스킬 창을 받는 중입니다.</span>
      </div>
    )
  }

  const loaded = loadedCatalog(catalog)
  const skillWindow = loaded !== null ? skillWindowOf(loaded, detail.character, style) : null
  const job = skillWindow !== null ? skillStatsJobOf(detail) : null

  if (job === null) {
    return (
      <SkillColumns
        detail={detail}
        style={style}
        catalog={loaded}
        skillWindow={skillWindow}
        stats={null}
        role={null}
      />
    )
  }

  return (
    <SkillColumnsWithStats
      detail={detail}
      style={style}
      catalog={loaded}
      skillWindow={skillWindow}
      job={job}
    />
  )
}
