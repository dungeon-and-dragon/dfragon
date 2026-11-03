import { Button } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { CameraIcon } from './CameraIcon'
import { HeaderTooltip } from './HeaderTooltip'
import { triggerStyles } from './HeaderTooltip.style'
import { styles } from './CaptureButton.style'

export function CaptureButton({
  target,
  disabled,
  onClick
}: {
  target: string
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <HeaderTooltip label="캡처하기">
      <span {...stylex.props(triggerStyles.wrapper)}>
        <Button
          variant={disabled ? 'ghost' : 'primary'}
          size="sm"
          aria-label={`${target} 캡처`}
          disabled={disabled}
          onClick={onClick}
          {...stylex.props(styles.button)}
        >
          <CameraIcon width={16} height={16} />
        </Button>
      </span>
    </HeaderTooltip>
  )
}
