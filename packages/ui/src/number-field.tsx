import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { MinusIcon, PlusIcon } from './icons'

export type NumberFieldProps = {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  format?: Intl.NumberFormatOptions
  'aria-label': string
  decrementLabel?: string
  incrementLabel?: string
}

export function NumberField({
  value,
  onValueChange,
  min,
  max,
  disabled = false,
  format,
  'aria-label': label,
  decrementLabel = `${label} 내리기`,
  incrementLabel = `${label} 올리기`
}: NumberFieldProps): React.JSX.Element {
  // 입력칸을 비우면 Base UI가 null을 주는데, 값이 없는 상태는 두지 않으므로 전하지 않고 blur 때 지금 값으로 되돌린다.
  function change(next: number | null): void {
    if (next !== null) {
      onValueChange(next)
    }
  }

  return (
    <BaseNumberField.Root
      value={value}
      onValueChange={change}
      min={min}
      max={max}
      disabled={disabled}
      format={format}
    >
      <BaseNumberField.Group className="number-field">
        <BaseNumberField.Decrement aria-label={decrementLabel} className="number-field-button">
          <MinusIcon />
        </BaseNumberField.Decrement>
        {/* Base UI의 기본 역할 설명은 영어 "Number field"라 한국어로 바꾼다. */}
        <BaseNumberField.Input
          aria-label={label}
          aria-roledescription="숫자 입력"
          className="number-field-input"
        />
        <BaseNumberField.Increment aria-label={incrementLabel} className="number-field-button">
          <PlusIcon />
        </BaseNumberField.Increment>
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  )
}
