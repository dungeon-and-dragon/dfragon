import { type SkillIconImage, type SkillMarks, SkillSprite, skillMarkOf } from '#entities/catalog'
import { SKILL_ICON } from './skill-classes'

const HEADING = 'section-title'
const EMPTY_CELL = `${SKILL_ICON} box-border rounded-control border border-line-strong bg-inset`
const MARK_SIZE: Readonly<Record<keyof SkillMarks, string>> = {
  evolution: 'size-[17px]',
  enhancement: 'size-[18px]'
}

export type SkillUpgradeRate = Readonly<{
  name: string
  icon: SkillIconImage | null
  rates: readonly [string, string]
}>

function UpgradeRateSection({
  kind,
  heading,
  rows,
  marks
}: {
  kind: keyof SkillMarks
  heading: string
  rows: readonly SkillUpgradeRate[]
  marks: SkillMarks
}): React.JSX.Element | null {
  if (rows.length === 0) {
    return null
  }

  return (
    <section aria-label={heading}>
      <h2 className={HEADING}>{heading}</h2>
      <ol className="m-0 list-none p-0">
        {rows.map(({ name, icon, rates }) => (
          <li
            key={name}
            className="box-border flex min-h-[48px] items-center gap-3 border-b border-line px-4 py-2"
          >
            {icon !== null ? (
              <span className={SKILL_ICON}>
                <SkillSprite icon={icon} label={name} />
              </span>
            ) : (
              <span aria-hidden="true" className={EMPTY_CELL} />
            )}
            <span className="min-w-0 grow truncate">{name}</span>
            {([1, 2] as const).map((type) => (
              <span key={type} className="flex shrink-0 items-center gap-1">
                <img
                  src={skillMarkOf(marks, kind, type)}
                  alt=""
                  draggable={false}
                  className={`${MARK_SIZE[kind]} shrink-0`}
                />
                <span className="num w-[48px] text-right">{rates[type - 1]}</span>
              </span>
            ))}
          </li>
        ))}
      </ol>
    </section>
  )
}

export function SkillUpgradeRates({
  evolutions,
  enhancements,
  marks
}: {
  evolutions: readonly SkillUpgradeRate[]
  enhancements: readonly SkillUpgradeRate[]
  marks: SkillMarks
}): React.JSX.Element {
  return (
    <>
      <UpgradeRateSection kind="evolution" heading="스킬 개화" rows={evolutions} marks={marks} />
      <UpgradeRateSection
        kind="enhancement"
        heading="스킬 강화"
        rows={enhancements}
        marks={marks}
      />
    </>
  )
}
