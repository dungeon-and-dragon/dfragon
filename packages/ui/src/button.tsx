import type { ComponentType } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = PublicProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

function ButtonImpl({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  style,
  ...buttonProps
}: ButtonProps & ForwardedStyle) {
  return (
    <button
      data-loading={loading ? '' : undefined}
      {...buttonProps}
      {...withForwardedStyle({ className: `btn btn-${variant} btn-${size}` }, { className, style })}
    />
  )
}

export const Button: ComponentType<ButtonProps> = ButtonImpl
