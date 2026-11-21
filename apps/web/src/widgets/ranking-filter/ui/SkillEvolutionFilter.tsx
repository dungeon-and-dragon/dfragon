import { Button } from '@dfragon/ui'
import { type SkillIconImage, type SkillMarks, SkillSprite, skillMarkOf } from '#entities/catalog'
import type { SkillEvolutionChoice, SkillEvolutionType } from '#entities/ranking'
import { EVOLUTION_FILTER_LIMIT } from '#shared/config/ranking'

const LOADING_CELLS = 4
const EVOLUTION_TYPES: readonly SkillEvolutionType[] = [1, 2]
const GRID = 'grid min-w-0 grow grid-cols-2 gap-x-8 gap-y-3 max-sm:grid-cols-1'
const BRANCH =
  'box-border inline-flex h-[28px] items-center gap-2 rounded-control border px-2 text-xs'
const BRANCH_IDLE = 'border-dashed border-line-strong bg-surface text-fg-subtle hover:bg-control'
const BRANCH_PICKED = 'border-solid border-signal bg-inset font-semibold text-fg shadow-selected'
const BRANCH_DISABLED = 'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-surface'
const PIXELATED = '[image-rendering:pixelated]'

export type EvolutionSkill = Readonly<{
  name: string
  icon: SkillIconImage | null
  branchNames: Readonly<Record<SkillEvolutionType, string>>
}>

export function SkillEvolutionGrid({
  skills,
  marks,
  evolutions,
  onPick
}: {
  skills: readonly EvolutionSkill[]
  marks: SkillMarks | null
  evolutions: readonly SkillEvolutionChoice[]
  onPick: (name: string, type: SkillEvolutionType) => void
}): React.JSX.Element {
  const full = evolutions.length >= EVOLUTION_FILTER_LIMIT

  return (
    <div className={GRID}>
      {skills.map((skill) => {
        const picked = evolutions.find(({ name }) => name === skill.name)?.type ?? null

        return (
          <EvolutionCell
            key={skill.name}
            skill={skill}
            marks={marks}
            picked={picked}
            blocked={full && picked === null}
            onPick={onPick}
          />
        )
      })}
    </div>
  )
}

function EvolutionCell({
  skill: { name, icon, branchNames },
  marks,
  picked,
  blocked,
  onPick
}: {
  skill: EvolutionSkill
  marks: SkillMarks | null
  picked: SkillEvolutionType | null
  // API가 받는 개화 쌍 수에 닿으면 아직 고르지 않은 스킬은 고를 수 없다.
  blocked: boolean
  onPick: (name: string, type: SkillEvolutionType) => void
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-3 max-sm:flex-wrap">
      <span className="block size-game-icon shrink-0">
        {icon !== null ? (
          <SkillSprite icon={icon} />
        ) : (
          <span
            aria-hidden="true"
            className="box-border block size-game-icon rounded-control border border-line-strong bg-inset"
          />
        )}
      </span>
      <span className="w-[128px] shrink-0 truncate font-medium">{name}</span>
      <div className="flex flex-wrap gap-2">
        {EVOLUTION_TYPES.map((type) => (
          <EvolutionButton
            key={type}
            skillName={name}
            type={type}
            label={branchNames[type]}
            mark={marks !== null ? skillMarkOf(marks, 'evolution', type) : null}
            picked={picked === type}
            disabled={blocked}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  )
}

function EvolutionButton({
  skillName,
  type,
  label,
  mark,
  picked,
  disabled,
  onPick
}: {
  skillName: string
  type: SkillEvolutionType
  label: string
  mark: string | null
  picked: boolean
  disabled: boolean
  onPick: (name: string, type: SkillEvolutionType) => void
}): React.JSX.Element {
  function handleClick(): void {
    onPick(skillName, type)
  }

  return (
    <button
      type="button"
      aria-pressed={picked}
      disabled={disabled}
      aria-label={`${skillName} ${label}`}
      onClick={handleClick}
      className={`${BRANCH} ${picked ? BRANCH_PICKED : BRANCH_IDLE} ${BRANCH_DISABLED}`}
    >
      {mark !== null && (
        <img
          src={mark}
          alt=""
          draggable={false}
          className={`size-[17px] ${PIXELATED} ${picked ? '' : 'opacity-45'}`}
        />
      )}
      {label}
    </button>
  )
}

export function SkillEvolutionSkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true" className={GRID}>
      <span role="status" className="sr-only">
        개화 스킬을 받는 중입니다.
      </span>
      {Array.from({ length: LOADING_CELLS }, (_, index) => (
        <div key={index} aria-hidden="true" className="flex h-8 items-center gap-3">
          <span className="skeleton block size-game-icon shrink-0" />
          <span className="skeleton-text w-[96px]" />
          <span className="skeleton-text w-[120px] max-sm:w-[88px]" />
        </div>
      ))}
    </div>
  )
}

export function SkillEvolutionFailure({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-2">
      <p role="alert" className="m-0 flex h-8 items-center text-sm text-fg-danger">
        개화 스킬을 받지 못했습니다.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  )
}
