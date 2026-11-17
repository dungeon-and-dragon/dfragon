import { Switch as BaseSwitch } from '@base-ui/react/switch'
import type { ComponentType } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type SwitchProps = Omit<PublicProps<typeof BaseSwitch.Root>, 'children'>

function SwitchImpl({ className, style, ...props }: SwitchProps & ForwardedStyle) {
  return (
    <BaseSwitch.Root
      {...props}
      {...withForwardedStyle({ className: 'switch' }, { className, style })}
    >
      <BaseSwitch.Thumb className="switch-thumb" />
    </BaseSwitch.Root>
  )
}

export const Switch: ComponentType<SwitchProps> = SwitchImpl
