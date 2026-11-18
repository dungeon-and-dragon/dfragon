import type { ComponentType, ReactNode } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type IconButtonProps = Omit<PublicProps<'button'>, 'children'> & {
  'aria-label': string
  icon: ReactNode
  size?: 'sm' | 'md' | 'lg'
  pressed?: boolean
}

function IconButtonImpl({
  icon,
  size = 'md',
  pressed,
  className,
  style,
  ...buttonProps
}: IconButtonProps & ForwardedStyle) {
  return (
    <button
      {...buttonProps}
      aria-pressed={pressed ?? buttonProps['aria-pressed']}
      {...withForwardedStyle({ className: `icon-btn icon-btn-${size}` }, { className, style })}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}

export const IconButton: ComponentType<IconButtonProps> = IconButtonImpl
