import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import type { ComponentType } from 'react'
import { CheckIcon } from './icons'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type CheckboxProps = Omit<PublicProps<typeof BaseCheckbox.Root>, 'children'>

function CheckboxImpl({ className, style, ...props }: CheckboxProps & ForwardedStyle) {
  return (
    <BaseCheckbox.Root
      {...props}
      {...withForwardedStyle({ className: 'checkbox' }, { className, style })}
    >
      <BaseCheckbox.Indicator className="checkbox-indicator">
        <CheckIcon />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

export const Checkbox: ComponentType<CheckboxProps> = CheckboxImpl
