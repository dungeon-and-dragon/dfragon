import { ToggleGroup } from '@base-ui/react/toggle-group'
import { ChipImpl } from './chip'

export type ChipGroupItem<Value extends string> = Readonly<{ value: Value; label: string }>

export type ChipGroupProps<Value extends string> = {
  items: readonly ChipGroupItem<Value>[]
  value: Value
  onValueChange: (value: Value) => void
  size?: 'sm' | 'md'
  'aria-label'?: string
  'aria-labelledby'?: string
}

export function ChipGroup<Value extends string>({
  items,
  value,
  onValueChange,
  size = 'sm',
  ...labelProps
}: ChipGroupProps<Value>): React.JSX.Element {
  // 하나만 고르는 묶음이라 이미 고른 칩을 다시 눌러 빈 배열이 오면 선택을 그대로 둔다.
  function change([next]: Value[]): void {
    if (next !== undefined) {
      onValueChange(next)
    }
  }

  return (
    <ToggleGroup {...labelProps} value={[value]} onValueChange={change} className="chip-group">
      {items.map((item) => (
        <ChipImpl
          key={item.value}
          value={item.value}
          className={size === 'md' ? 'chip-md' : undefined}
        >
          {item.label}
        </ChipImpl>
      ))}
    </ToggleGroup>
  )
}
