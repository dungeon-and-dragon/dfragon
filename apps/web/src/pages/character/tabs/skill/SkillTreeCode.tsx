import { ClipboardCopyButton } from '#shared/ui/ClipboardCopyButton'
import { itemTableClasses } from '#pages/character/tabs/equipment/item-classes'

const { heading: HEADING } = itemTableClasses

export function SkillTreeCode({ hash }: { hash: string }): React.JSX.Element {
  return (
    <section aria-label="스킬 트리 코드">
      <h2 className={HEADING}>스킬 트리 코드</h2>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <code
          title={hash}
          className="box-border h-[28px] min-w-0 grow truncate rounded-control border border-line bg-surface px-2 num text-xs leading-[26px] text-fg-muted"
        >
          {hash}
        </code>
        <ClipboardCopyButton text={hash} label="코드 복사" />
      </div>
    </section>
  )
}
