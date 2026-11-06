import * as stylex from '@stylexjs/stylex'
import type { SkillIconImage } from '@dfragon/client-core/shared/search/skill-window'
import { styles } from './SkillTab.style'

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
      {...stylex.props(
        styles.image,
        styles.sprite(icon.sprite, icon.x, icon.y),
        dim && styles.unlearned
      )}
    />
  )
}
