import type { ChangeEvent } from 'react'

export function SnapshotAdventureField({
  slot,
  value,
  notice,
  onChange
}: {
  slot: number
  value: string
  notice: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value)
  }

  return (
    <input
      type="text"
      aria-label={`${slot}번 모험단`}
      placeholder="모험단 이름"
      title={notice || undefined}
      value={value}
      onChange={handleChange}
      className="m-0 box-border h-6 w-full max-w-[130px] rounded-control border border-dashed border-line-input bg-canvas px-1.5 py-0 text-sm text-fg-adventure [font-family:inherit] outline-none placeholder:text-fg-subtle focus:border-solid focus:border-signal"
    />
  )
}
