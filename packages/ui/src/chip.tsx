import { Toggle } from '@base-ui/react/toggle'
import type { ComponentType } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type ChipProps = PublicProps<typeof Toggle>

function ChipImpl({ className, style, ...props }: ChipProps & ForwardedStyle) {
  return <Toggle {...props} {...withForwardedStyle({ className: 'chip' }, { className, style })} />
}

export const Chip: ComponentType<ChipProps> = ChipImpl
