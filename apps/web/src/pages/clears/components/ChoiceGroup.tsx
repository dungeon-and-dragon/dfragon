export type Choice<Value extends string> = Readonly<{ value: Value; label: string }>

export function ChoiceGroup<Value extends string>({
  label,
  choices,
  value,
  large = false,
  onChange
}: {
  label: string
  choices: readonly Choice<Value>[]
  value: Value
  large?: boolean
  onChange: (value: Value) => void
}): React.JSX.Element {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 flex-wrap gap-1.5">
      {choices.map((choice) => (
        <ChoiceButton
          key={choice.value}
          choice={choice}
          pressed={choice.value === value}
          large={large}
          onChange={onChange}
        />
      ))}
    </div>
  )
}

function ChoiceButton<Value extends string>({
  choice: { value, label },
  pressed,
  large,
  onChange
}: {
  choice: Choice<Value>
  pressed: boolean
  large: boolean
  onChange: (value: Value) => void
}): React.JSX.Element {
  function select(): void {
    onChange(value)
  }

  return (
    <button
      type="button"
      aria-pressed={pressed}
      // chip 클래스는 Base UI Toggle이 붙이는 data-pressed로 켜짐을 그린다.
      data-pressed={pressed ? '' : undefined}
      onClick={select}
      className={large ? 'chip chip-md' : 'chip'}
    >
      {label}
    </button>
  )
}
