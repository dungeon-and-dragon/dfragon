import { Popover as BasePopover } from '@base-ui/react/popover'
import type { ComponentType } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type PopoverChangeEventDetails = BasePopover.Root.ChangeEventDetails

export type PopoverPopupProps = PublicProps<typeof BasePopover.Popup> &
  Pick<BasePopover.Portal.Props, 'container'> &
  Pick<BasePopover.Positioner.Props, 'anchor' | 'side' | 'align' | 'sideOffset'>

function PopoverPopupImpl({
  container,
  anchor,
  side = 'bottom',
  align = 'start',
  sideOffset = 6,
  className,
  style,
  ...props
}: PopoverPopupProps & ForwardedStyle) {
  return (
    <BasePopover.Portal container={container}>
      <BasePopover.Positioner
        anchor={anchor}
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="popover-positioner"
      >
        <BasePopover.Popup
          {...props}
          {...withForwardedStyle({ className: 'popover' }, { className, style })}
        />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

const PopoverPopup: ComponentType<PopoverPopupProps> = PopoverPopupImpl

export type PopoverTitleProps = PublicProps<typeof BasePopover.Title>

function PopoverTitleImpl({ className, style, ...props }: PopoverTitleProps & ForwardedStyle) {
  return (
    <BasePopover.Title
      {...props}
      {...withForwardedStyle({ className: 'popover-title' }, { className, style })}
    />
  )
}

const PopoverTitle: ComponentType<PopoverTitleProps> = PopoverTitleImpl

export const Popover = {
  Root: BasePopover.Root,
  Trigger: BasePopover.Trigger,
  Popup: PopoverPopup,
  Title: PopoverTitle,
  Close: BasePopover.Close
}
