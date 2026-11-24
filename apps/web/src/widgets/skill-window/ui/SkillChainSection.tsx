import { ChevronRightIcon } from '@dfragon/ui'
import { type SkillChain, SkillSprite } from '#entities/catalog'
import { SKILL_ICON } from './skill-classes'

const HEADING = 'section-title'

export function SkillChainSection({ chain }: { chain: SkillChain | null }): React.JSX.Element {
  if (chain === null) {
    return <h2 className={HEADING}>스킬 체인 없음</h2>
  }

  return (
    <section aria-label="스킬 체인">
      <h2 className={HEADING}>스킬 체인</h2>
      <ol className="m-0 flex list-none flex-wrap items-start gap-y-2 border-b border-line px-4 py-4">
        {chain.skills.map(({ name, icon }, index) => (
          <li key={`${name}-${index}`} className="flex items-start gap-1">
            <span className="flex w-16 flex-col items-center gap-2 text-center text-2xs text-fg-muted">
              {icon !== null ? (
                <span className={SKILL_ICON}>
                  <SkillSprite icon={icon} />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`${SKILL_ICON} box-border rounded-control border border-line-strong bg-inset`}
                />
              )}
              {name}
            </span>
            {index < chain.skills.length - 1 && (
              <ChevronRightIcon className="mt-2 size-icon-sm shrink-0 text-fg-subtle" />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
