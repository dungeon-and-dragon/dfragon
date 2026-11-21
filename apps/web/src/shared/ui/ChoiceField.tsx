import { ChipGroup, type ChipGroupItem, Select } from '@dfragon/ui'

export function ChoiceField({
  label,
  labelId,
  items,
  value,
  onValueChange
}: {
  label: string
  labelId?: string
  items: readonly ChipGroupItem<string>[]
  value: string
  onValueChange: (value: string) => void
}): React.JSX.Element {
  function handleSelect(next: string | null): void {
    if (next != null) {
      onValueChange(next)
    }
  }

  return (
    <>
      <div className="max-md:hidden">
        <ChipGroup
          {...(labelId !== undefined ? { 'aria-labelledby': labelId } : { 'aria-label': label })}
          items={items}
          value={value}
          onValueChange={onValueChange}
        />
      </div>
      <div className="md:hidden">
        <Select.Root value={value} onValueChange={handleSelect} items={items}>
          <Select.Trigger size="sm" aria-label={label}>
            <Select.Value />
          </Select.Trigger>
          <Select.Popup aria-label={label}>
            {items.map((item) => (
              <Select.Item key={item.value} value={item.value}>
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Root>
      </div>
    </>
  )
}
