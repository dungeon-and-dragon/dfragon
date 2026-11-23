import { Select } from '@dfragon/ui'
import { tuneNumeral } from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'

// 캐릭터 상세 화면처럼 조율하지 않은 0단계는 단계 숫자 없이 빈 값으로 보인다.
function tuneLabel(level: number): string {
  const numeral = tuneNumeral(level)

  if (numeral === null) {
    return MISSING_VALUE
  }

  return numeral
}

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
  const levels = Array.from({ length: maxTune + 1 }, (_, level) => level)

  function changeTune(value: number | null): void {
    if (value !== null) {
      onChange(value)
    }
  }

  return (
    <div className="grid w-[64px] shrink-0">
      <Select.Root value={tune} onValueChange={changeTune}>
        <Select.Trigger size="sm" aria-label={label}>
          <Select.Value>{(value: number) => tuneLabel(value)}</Select.Value>
        </Select.Trigger>
        <Select.Popup aria-label={label}>
          {levels.map((level) => (
            <Select.Item key={level} value={level}>
              <Select.ItemText>{tuneLabel(level)}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Popup>
      </Select.Root>
    </div>
  )
}
