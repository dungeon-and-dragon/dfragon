import { CameraIcon } from './CameraIcon'
import { HeaderTooltip, tooltipTriggerClass } from './HeaderTooltip'

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
      <span className={tooltipTriggerClass}>
        {/* 상단 바 헤더의 캡처 주 버튼은 32px 정사각형이라 공용 Button의 좌우 여백을 덮어야 해 버튼 class를 직접 쓴다. */}
        <button
          type="button"
          aria-label={`${target} 캡처`}
          disabled={disabled}
          onClick={onClick}
          className={`btn btn-sm w-8 px-0 ${disabled ? 'btn-ghost' : 'btn-primary'}`}
        >
          <CameraIcon width={16} height={16} />
        </button>
      </span>
    </HeaderTooltip>
  )
}
