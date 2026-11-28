import {
  type EnhancementRow,
  type EvolutionBranch,
  EvolutionBranchTooltip,
  type EvolutionRow,
  type SkillMarks,
  type SkillUpgradeBoard,
  skillMarkOf,
  SkillSprite
} from '#entities/catalog'
import { ENHANCEMENT_LABELS } from '#widgets/skill-window/lib/upgrade-labels'
import { type SkillAdoptionSource, SkillAdoptionHover } from './SkillAdoptionTooltip'
import { EVOLUTION_MARK, PIXELATED, SKILL_ICON } from './skill-classes'

const HEADING = 'section-title'
const PICKED_RING = 'outline-1 -outline-offset-1 outline-solid outline-signal shadow-selected'
const BRANCH =
  'box-border inline-flex h-[28px] cursor-default items-center gap-2 rounded-control border px-2 text-xs'
const BRANCH_IDLE = 'border-dashed border-line-strong bg-surface text-fg-subtle hover:bg-control'
const BRANCH_PICKED = 'border-solid border-signal bg-inset font-semibold text-fg shadow-selected'
const ROWS = 'm-0 list-none p-0'
const ROW = 'box-border flex min-h-[56px] items-center gap-3 border-b border-line px-4 py-2'
const ROW_BODY = 'flex min-w-0 grow flex-col gap-2'
const BRANCHES = 'flex flex-wrap gap-2'

function Branch({
  picked,
  mark,
  label,
  branch
}: {
  picked: boolean
  mark: string
  label: string
  branch?: EvolutionBranch
}): React.JSX.Element {
  const content = (
    <>
      <img
        src={mark}
        alt=""
        draggable={false}
        className={`size-[17px] ${PIXELATED} ${picked ? '' : 'opacity-45'}`}
      />
      {label}
    </>
  )
  const branchClassName = `${BRANCH} ${picked ? BRANCH_PICKED : BRANCH_IDLE}`
  if (branch === undefined) {
    return (
      <span aria-current={picked || undefined} className={branchClassName}>
        {content}
      </span>
    )
  }

  return (
    <EvolutionBranchTooltip branch={branch}>
      <button type="button" aria-current={picked || undefined} className={branchClassName}>
        {content}
      </button>
    </EvolutionBranchTooltip>
  )
}

// 표가 화면 오른쪽 끝 열이라 Tooltip을 왼쪽에 띄워 잘리지 않게 한다.
const ADOPTION_SIDE = 'left'

function UpgradeSkillIcon({
  row,
  evolutionMark,
  source
}: {
  row: EvolutionRow | EnhancementRow
  evolutionMark: string | null
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <SkillAdoptionHover
      skill={row}
      source={source}
      side={ADOPTION_SIDE}
      trigger={<span className={`${SKILL_ICON} ${row.picked !== null ? PICKED_RING : ''}`} />}
    >
      <SkillSprite icon={row.icon} />
      {evolutionMark !== null && (
        <img
          src={evolutionMark}
          alt=""
          draggable={false}
          className={`${EVOLUTION_MARK} ${PIXELATED}`}
        />
      )}
    </SkillAdoptionHover>
  )
}

function RowTitle({
  row,
  source
}: {
  row: EvolutionRow | EnhancementRow
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <SkillAdoptionHover
      skill={row}
      source={source}
      side={ADOPTION_SIDE}
      trigger={<span className="flex items-baseline gap-2 self-start font-medium" />}
    >
      {row.name}
      {row.requiredLevel !== null && (
        <span className="text-2xs text-fg-subtle select-none">{`${row.requiredLevel}레벨`}</span>
      )}
    </SkillAdoptionHover>
  )
}

function EvolutionSection({
  rows,
  marks,
  source
}: {
  rows: readonly EvolutionRow[]
  marks: SkillMarks
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <section aria-label="스킬 개화">
      <h2 className={HEADING}>스킬 개화</h2>
      <ul className={ROWS}>
        {rows.map((row) => (
          <li key={row.skillId} className={ROW}>
            <UpgradeSkillIcon
              row={row}
              evolutionMark={
                row.picked !== null ? skillMarkOf(marks, 'evolution', row.picked) : null
              }
              source={source}
            />
            <div className={ROW_BODY}>
              <RowTitle row={row} source={source} />
              <div className={BRANCHES}>
                {row.branches.map((branch) => (
                  <Branch
                    key={branch.type}
                    picked={row.picked === branch.type}
                    mark={skillMarkOf(marks, 'evolution', branch.type)}
                    label={branch.name}
                    branch={branch}
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EnhancementSection({
  rows,
  marks,
  source
}: {
  rows: readonly EnhancementRow[]
  marks: SkillMarks
  source: SkillAdoptionSource
}): React.JSX.Element {
  if (rows.length === 0) {
    return <h2 className={HEADING}>스킬 강화 없음</h2>
  }

  return (
    <section aria-label="스킬 강화">
      <h2 className={HEADING}>스킬 강화</h2>
      <ul className={ROWS}>
        {rows.map((row) => (
          <li key={row.skillId} className={ROW}>
            <UpgradeSkillIcon row={row} evolutionMark={null} source={source} />
            <div className={ROW_BODY}>
              <RowTitle row={row} source={source} />
              <div className={BRANCHES}>
                {row.branches.map((branch) => (
                  <Branch
                    key={branch.type}
                    picked={row.picked === branch.type}
                    mark={skillMarkOf(marks, 'enhancement', branch.type)}
                    label={ENHANCEMENT_LABELS[branch.type]}
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SkillUpgradeSections({
  board,
  source
}: {
  board: SkillUpgradeBoard
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <>
      <EvolutionSection rows={board.evolutions} marks={board.marks} source={source} />
      <EnhancementSection rows={board.enhancements} marks={board.marks} source={source} />
    </>
  )
}
