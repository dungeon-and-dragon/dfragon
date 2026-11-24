import { Chip } from '@dfragon/ui'
import { tuneNumeral } from '#entities/character'

const NO_TUNE = 0

// 켜진 단계를 다시 누르면 조율하지 않은 0단계로 돌아가므로, 빈 선택을 막는 ChipGroup 대신 Chip을 직접 묶는다.
export function TuneSelect({
  label,
  tune,
  maxTune,
  onChange
}: {
  label: string
  tune: number
  maxTune: number
  onChange: (tune: number) => void
}): React.JSX.Element {
  const levels = Array.from({ length: maxTune }, (_, index) => index + 1)

  return (
    <div className="chip-group" role="group" aria-label={label}>
      {levels.map((level) => {
        function changePressed(pressed: boolean): void {
          const next = pressed ? level : NO_TUNE
          onChange(next)
        }

        return (
          <Chip key={level} pressed={tune === level} onPressedChange={changePressed}>
            {tuneNumeral(level)}
          </Chip>
        )
      })}
    </div>
  )
}
