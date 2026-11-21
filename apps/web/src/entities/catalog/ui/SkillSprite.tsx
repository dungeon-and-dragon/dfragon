import type { SkillIconImage } from '#entities/catalog/model/skill-window'

export function SkillSprite({
  icon,
  label,
  dim = false
}: {
  icon: SkillIconImage
  label?: string
  dim?: boolean
}): React.JSX.Element {
  return (
    <span
      {...(label !== undefined ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={`block size-game-icon bg-no-repeat ${dim ? 'opacity-30 grayscale' : ''}`}
      style={{
        backgroundImage: `url("${icon.sprite}")`,
        backgroundPosition: `${-icon.x}px ${-icon.y}px`
      }}
    />
  )
}
