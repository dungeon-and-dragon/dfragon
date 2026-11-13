import * as stylex from '@stylexjs/stylex'
import { styles } from './ChoiceGroup.style'

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
    <div role="group" aria-label={label} {...stylex.props(styles.group)}>
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
      onClick={select}
      {...stylex.props(styles.option, large && styles.large, pressed && styles.pressed)}
    >
      {label}
    </button>
  )
}
