import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import type { ComponentType, HTMLAttributes } from 'react'
import { CheckIcon, DashIcon } from './icons'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type CheckboxProps = Omit<PublicProps<typeof BaseCheckbox.Root>, 'children'>

function renderIndicator(
  indicatorProps: HTMLAttributes<HTMLSpanElement>,
  state: { indeterminate: boolean }
) {
  const icon = state.indeterminate ? <DashIcon /> : <CheckIcon />

  return <span {...indicatorProps}>{icon}</span>
}

function CheckboxImpl({ className, style, ...props }: CheckboxProps & ForwardedStyle) {
  return (
    <BaseCheckbox.Root
      {...props}
      {...withForwardedStyle({ className: 'checkbox' }, { className, style })}
    >
      <BaseCheckbox.Indicator className="checkbox-indicator" render={renderIndicator} />
    </BaseCheckbox.Root>
  )
}

export const Checkbox: ComponentType<CheckboxProps> = CheckboxImpl
