import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import {
  type ComponentType,
  createContext,
  type MouseEvent,
  useContext,
  useId,
  useRef,
  useState
} from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type TooltipPopupProps = PublicProps<typeof BaseTooltip.Popup> &
  Pick<BaseTooltip.Portal.Props, 'container'> &
  Pick<BaseTooltip.Positioner.Props, 'side' | 'align' | 'sideOffset'>

type TouchRoot = Readonly<{ handle: BaseTooltip.Handle<unknown>; disabled: boolean }>

const TouchRootContext = createContext<TouchRoot | null>(null)

// trigger 안쪽의 버튼, 링크를 탭하면 그 동작이 이기고 이름 Tooltip은 열지 않는다.
const CONTROL_SELECTOR =
  'a[href], button, input, select, textarea, label, [role="button"], [role="link"]'

// 창 가장자리 여백. 375px 창에서 Tooltip 폭은 343px까지 된다.
const VIEWPORT_GUTTER = 16

function TooltipRoot<Payload>({
  handle,
  disabled = false,
  ...props
}: BaseTooltip.Root.Props<Payload>) {
  const [ownHandle] = useState(() => BaseTooltip.createHandle<Payload>())
  const rootHandle = handle ?? ownHandle

  return (
    <TouchRootContext value={{ handle: rootHandle, disabled }}>
      <BaseTooltip.Root {...props} handle={rootHandle} disabled={disabled} />
    </TouchRootContext>
  )
}

// Base UI Tooltip은 hover를 마우스에서만, focus를 :focus-visible에서만 받아 터치로는 열리지 않는다.
// 터치 탭은 handle로 직접 열고 닫고, 바깥 탭으로 닫는 일은 Base UI의 dismiss가 맡는다.
function TooltipTrigger<Payload>({
  id,
  handle,
  disabled = false,
  onPointerDown,
  onClick,
  ...props
}: BaseTooltip.Trigger.Props<Payload>) {
  const root = useContext(TouchRootContext)
  const generatedId = useId()
  const triggerId = id ?? generatedId
  const pointerTypeRef = useRef('')
  const triggerHandle = handle ?? root?.handle

  const handlePointerDown: BaseTooltip.Trigger.Props<Payload>['onPointerDown'] = (event) => {
    pointerTypeRef.current = event.pointerType
    onPointerDown?.(event)
  }

  const handleClick: BaseTooltip.Trigger.Props<Payload>['onClick'] = (event) => {
    onClick?.(event)
    const touched = pointerTypeRef.current === 'touch'
    pointerTypeRef.current = ''

    if (!touched || triggerHandle == null || disabled || root?.disabled === true) {
      return
    }

    const trigger = event.currentTarget
    const control = event.target instanceof Element ? event.target.closest(CONTROL_SELECTOR) : null

    if (control !== null && control !== trigger && trigger.contains(control)) {
      return
    }

    // 링크 행 안의 trigger(아이템 이름)는 탭하면 링크로 이동하지 않고 Tooltip을 연다.
    event.preventDefault()

    if (trigger.hasAttribute('data-popup-open')) {
      triggerHandle.close()
    } else {
      triggerHandle.open(triggerId)
    }
  }

  return (
    <BaseTooltip.Trigger
      {...props}
      id={triggerId}
      handle={handle}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    />
  )
}

// Popup은 portal에 그려도 React 이벤트는 Root를 감싼 링크 행까지 올라가, Tooltip 안을 누르면 링크로 이동한다.
function stopPropagation(event: MouseEvent): void {
  event.stopPropagation()
}

function TooltipPopupImpl({
  container,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  className,
  style,
  ...props
}: TooltipPopupProps & ForwardedStyle) {
  return (
    <BaseTooltip.Portal container={container}>
      <BaseTooltip.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={VIEWPORT_GUTTER}
        className="tooltip-positioner"
        onClick={stopPropagation}
      >
        <BaseTooltip.Popup
          {...props}
          {...withForwardedStyle({ className: 'tooltip' }, { className, style })}
        />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

const TooltipPopup: ComponentType<TooltipPopupProps> = TooltipPopupImpl

export const Tooltip = {
  Provider: BaseTooltip.Provider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Popup: TooltipPopup,
  createHandle: BaseTooltip.createHandle
}
