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
  type SkillWindowIcon,
  skillChainOf,
  skillMarkOf,
  skillUpgradeBoardOf,
  skillUpgradesOf,
  skillWindowOf,
  SkillSprite,
  useSkillWindowCatalog
} from '#entities/catalog'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { LoadingLine } from '#shared/ui/LoadingLine'
import type { CharacterTabProps } from './character-tab-props'
import { detailTabClasses as layout } from './detail-tab-classes'
import { type SkillAdoptionSource, SkillAdoptionHover } from './skill/SkillAdoptionTooltip'
import { SkillChainSection, SkillTreeCode, SkillUpgradeSections } from './skill/SkillSide'
import { ENHANCEMENT_MARK, EVOLUTION_MARK } from './skill/skill-classes'

const COMMON_ROW = 0

// 스킬 창은 11열(col 0~10)이다. 아이콘은 직업 sprite에서 28×28씩 잘라 그린다.
const SKILL_WINDOW_COLUMNS = 11
const SKILL_CELL_WIDTH = 44
const SKILL_CELL_HEIGHT = 48
const SKILL_ROW_LABEL_WIDTH = 36
const SKILL_WINDOW_BORDER_WIDTH = 1
const SKILL_WINDOW_WIDTH = SKILL_ROW_LABEL_WIDTH + SKILL_WINDOW_COLUMNS * SKILL_CELL_WIDTH
const SKILL_WINDOW_OUTER_WIDTH = SKILL_WINDOW_WIDTH + 2 * SKILL_WINDOW_BORDER_WIDTH

// 스킬 창은 열 폭에 맞춰 커지고 지금 크기보다 작아지지 않는다. sprite의 전체 크기를 모르므로
// background-size 대신 zoom으로 아이콘을 키우는데, zoom은 단위 없는 수만 받아 tan(atan2())로 길이 비율을 수로 바꾼다.
// 배율이 열 폭에서 정해져 Tailwind CSS class로 적을 수 없어 길이는 style로 준다.
const SKILL_WINDOW_SCALE = `max(1, tan(atan2(100cqi, ${SKILL_WINDOW_OUTER_WIDTH}px)))`
const SKILL_WINDOW_UNIT = `(${SKILL_WINDOW_SCALE} * 1px)`

const scaled = (px: number): string => `calc(${px} * ${SKILL_WINDOW_UNIT})`

const ROW_LABEL_SIZE = {
  width: scaled(SKILL_ROW_LABEL_WIDTH),
  height: scaled(SKILL_CELL_HEIGHT),
  fontSize: scaled(11),
  lineHeight: scaled(14)
}
const ROW_LINE_BORDER = { borderTop: `${scaled(1)} solid var(--color-line)` }
const ICON_SIZE = {
  width: scaled(SKILL_CELL_WIDTH),
  height: scaled(SKILL_CELL_HEIGHT),
  gap: scaled(4)
}
const LEVEL_SIZE = { height: scaled(10), fontSize: scaled(10), lineHeight: scaled(10) }

const LIST = 'm-0 flex list-none flex-col gap-1 p-0'
const LIST_ROW = 'flex items-baseline justify-between gap-2'
const SUBTLE = 'whitespace-nowrap text-fg-subtle'
// 스킬 창 최소 폭(테두리 포함 522px)에 왼쪽 열 여백과 오른쪽 340px 열을 더한 896px보다 탭이 좁으면 오른쪽 열을 아래로 내린다.
const ROOT =
  'grid grid-cols-[minmax(max-content,1fr)_340px] divide-x divide-line text-sm @max-[56rem]:grid-cols-1 @max-[56rem]:divide-x-0 @max-[56rem]:divide-y @max-[56rem]:overflow-x-auto'

function SkillIcon({
  icon,
  source
}: {
  icon: SkillWindowIcon
  source: SkillAdoptionSource
}): React.JSX.Element {
  const picked = icon.evolution !== null || icon.enhancement !== null

  return (
    <SkillAdoptionHover
      skill={icon}
      source={source}
      trigger={
        <span
          data-skill-id={icon.skillId}
          className="absolute flex flex-col items-center justify-center border-0 bg-transparent p-0 text-inherit"
          style={{
            ...ICON_SIZE,
            left: scaled(SKILL_ROW_LABEL_WIDTH + icon.col * SKILL_CELL_WIDTH),
            top: scaled(icon.row * SKILL_CELL_HEIGHT)
          }}
        />
      }
    >
      {/* zoom은 아이콘과 함께 개화, 강화 표식과 선택 테두리도 같은 배율로 키운다. */}
      <span
        className={`relative block select-none ${picked ? 'outline-1 -outline-offset-1 outline-solid outline-signal shadow-selected' : ''}`}
        style={{ zoom: SKILL_WINDOW_SCALE }}
      >
        <SkillSprite icon={icon.icon} label={icon.name} dim={!icon.learned} />
        {icon.evolution !== null && (
          <img
            src={skillMarkOf(source.marks, 'evolution', icon.evolution)}
            alt=""
            draggable={false}
            className={EVOLUTION_MARK}
          />
        )}
        {icon.enhancement !== null && (
          <img
            src={skillMarkOf(source.marks, 'enhancement', icon.enhancement)}
            alt=""
            draggable={false}
            className={ENHANCEMENT_MARK}
          />
        )}
      </span>
      <span
        className="num font-semibold whitespace-nowrap text-fg-muted select-none"
        style={LEVEL_SIZE}
      >
        {icon.learned && icon.level !== null ? `${icon.level}` : ''}
      </span>
    </SkillAdoptionHover>
  )
}

function SkillWindowGrid({
  skillWindow,
  source
}: {
  skillWindow: SkillWindow
  source: SkillAdoptionSource
}): React.JSX.Element {
  // 스킬 창은 최소 폭보다 좁은 칸에서 화면 전체가 아니라 스킬 창만 가로로 스크롤한다.
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="@container" style={{ minWidth: SKILL_WINDOW_OUTER_WIDTH }}>
        <div
          role="group"
          aria-label="스킬 창"
          className="relative shrink-0 rounded-control border-solid border-line bg-inset"
          style={{
            borderWidth: scaled(SKILL_WINDOW_BORDER_WIDTH),
            width: scaled(SKILL_WINDOW_WIDTH),
            height: scaled(skillWindow.rows.length * SKILL_CELL_HEIGHT)
          }}
        >
          {skillWindow.rows.map(({ row, requiredLevel }) => (
            <div key={row}>
              {row > COMMON_ROW && (
                <div
                  className="absolute inset-x-0 h-0"
                  style={{ ...ROW_LINE_BORDER, top: scaled(row * SKILL_CELL_HEIGHT) }}
                />
              )}
              <span
                className={`absolute left-0 flex items-center justify-center whitespace-nowrap text-fg-subtle select-none ${row === COMMON_ROW ? '' : 'num'}`}
                style={{ ...ROW_LABEL_SIZE, top: scaled(row * SKILL_CELL_HEIGHT) }}
              >
                {row === COMMON_ROW ? '공용' : requiredLevel}
              </span>
            </div>
          ))}
          {skillWindow.icons.map((icon) => (
            <SkillIcon key={`${icon.col},${icon.row}`} icon={icon} source={source} />
          ))}
        </div>
      </div>
    </div>
  )
}

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
