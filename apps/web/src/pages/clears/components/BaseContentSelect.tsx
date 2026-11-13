import { Select } from '@dfragon/ui'
import type { BaseContentOption } from '../clear-overview'

export function BaseContentSelect({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: readonly BaseContentOption[]
  value: string
  onChange: (id: string) => void
}): React.JSX.Element {
  function handleValueChange(next: string | null): void {
    if (next != null) {
      onChange(next)
    }
  }

  return (
    <Select.Root
      value={value}
      onValueChange={handleValueChange}
      items={options.map((option) => ({ value: option.id, label: option.label }))}
    >
      <Select.Trigger size="2xs" aria-label={label}>
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label={label}>
        {options.map((option) => (
          <Select.Item key={option.id} value={option.id}>
            <Select.ItemText>{option.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}
