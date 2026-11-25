import { ChevronRightIcon } from '@dfragon/ui'
import { Fragment } from 'react'
import { type SkillChain, SkillSprite } from '#entities/catalog'
import { SKILL_ICON } from './skill-classes'

const HEADING = 'section-title'
const EMPTY_CELL = `${SKILL_ICON} box-border rounded-control border border-line-strong bg-inset`

export type SkillChainRate = Readonly<{
  key: string
  skills: SkillChain['skills']
  rate: string
}>

export function SkillChainPanel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <section aria-label="스킬 체인">
      <h2 className={HEADING}>스킬 체인</h2>
      {children}
    </section>
  )
}

export function SkillChainRates({
  chains
}: {
  chains: readonly SkillChainRate[]
}): React.JSX.Element {
  return (
    <ol className="m-0 list-none p-0">
      {chains.map(({ key, skills, rate }) => (
        <li
          key={key}
          className="box-border flex min-h-[56px] items-center gap-3 border-b border-line px-4 py-2"
        >
          <span className="flex items-center gap-1">
            {skills.map(({ name, icon }, index) => (
              // 같은 스킬이 한 조합에 두 번 들어갈 수 있어 칸 번호를 key로 쓴다.
              <Fragment key={`cell-${index}`}>
                {index > 0 && <ChevronRightIcon className="size-icon-sm shrink-0 text-fg-subtle" />}
                {name !== null && icon !== null ? (
                  <span className={SKILL_ICON}>
                    <SkillSprite icon={icon} label={name} />
                  </span>
                ) : (
                  <span aria-hidden="true" className={EMPTY_CELL} />
                )}
              </Fragment>
            ))}
          </span>
          <span className="ml-auto num">{rate}</span>
        </li>
      ))}
    </ol>
  )
}
