import { Select as BaseSelect } from '@base-ui/react/select'
import type { ComponentType, CSSProperties } from 'react'
import { ChevronDownIcon } from './icons'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type SelectTriggerProps = PublicProps<typeof BaseSelect.Trigger> & {
  size?: '2xs' | 'xs' | 'sm' | 'md'
}

function SelectTriggerImpl({
  size = 'sm',
  children,
  className,
  style,
  ...props
}: SelectTriggerProps & ForwardedStyle) {
  return (
    <BaseSelect.Trigger
      {...props}
      {...withForwardedStyle({ className: `select select-${size}` }, { className, style })}
    >
      {children}
      <BaseSelect.Icon className="select-icon">
        <ChevronDownIcon />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

const SelectTrigger: ComponentType<SelectTriggerProps> = SelectTriggerImpl

export type SelectValueProps = PublicProps<typeof BaseSelect.Value>

function SelectValueImpl({ className, style, ...props }: SelectValueProps & ForwardedStyle) {
  return (
    <BaseSelect.Value
      {...props}
      {...withForwardedStyle({ className: 'select-value' }, { className, style })}
    />
  )
}

const SelectValue: ComponentType<SelectValueProps> = SelectValueImpl

export type SelectPopupProps = PublicProps<typeof BaseSelect.Popup> &
  Pick<BaseSelect.Portal.Props, 'container'> &
  Pick<BaseSelect.Positioner.Props, 'side' | 'align' | 'sideOffset'> & {
    columns?: number
  }

function listGridStyle(columns: number): CSSProperties {
  return { '--listbox-columns': columns } as CSSProperties
}

function SelectPopupImpl({
  container,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  columns,
  children,
  className,
  style,
  'aria-label': label,
  'aria-labelledby': labelledBy,
  ...props
}: SelectPopupProps & ForwardedStyle) {
  const isGrid = columns !== undefined

  return (
    <BaseSelect.Portal container={container}>
      <BaseSelect.Positioner
        alignItemWithTrigger={false}
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="listbox-positioner"
      >
        <BaseSelect.Popup
          {...props}
          {...withForwardedStyle({ className: 'listbox' }, { className, style })}
        >
          {/* Popup은 presentation이고 listbox 역할은 List가 가지므로 이름은 List에 붙인다. */}
          <BaseSelect.List
            aria-label={label}
            aria-labelledby={labelledBy}
            className={isGrid ? 'listbox-grid' : undefined}
            style={isGrid ? listGridStyle(columns) : undefined}
          >
            {children}
          </BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

const SelectPopup: ComponentType<SelectPopupProps> = SelectPopupImpl

export type SelectItemProps = PublicProps<typeof BaseSelect.Item>

function SelectItemImpl({
  children,
  className,
  style,
  ...props
}: SelectItemProps & ForwardedStyle) {
  return (
    <BaseSelect.Item
      {...props}
      {...withForwardedStyle({ className: 'listbox-item' }, { className, style })}
    >
      {/* Base UI는 children이 없으면 체크 이모지를 넣으므로 null을 넘긴다. */}
      <BaseSelect.ItemIndicator className="listbox-marker">{null}</BaseSelect.ItemIndicator>
      {children}
    </BaseSelect.Item>
  )
}

const SelectItem: ComponentType<SelectItemProps> = SelectItemImpl

export type SelectGroupLabelProps = PublicProps<typeof BaseSelect.GroupLabel>

function SelectGroupLabelImpl({
  className,
  style,
  ...props
}: SelectGroupLabelProps & ForwardedStyle) {
  return (
    <BaseSelect.GroupLabel
      {...props}
      {...withForwardedStyle({ className: 'listbox-group-label' }, { className, style })}
    />
  )
}

const SelectGroupLabel: ComponentType<SelectGroupLabelProps> = SelectGroupLabelImpl

export type SelectSeparatorProps = PublicProps<typeof BaseSelect.Separator>

function SelectSeparatorImpl({
  className,
  style,
  ...props
}: SelectSeparatorProps & ForwardedStyle) {
  return (
    <BaseSelect.Separator
      {...props}
      {...withForwardedStyle({ className: 'listbox-separator' }, { className, style })}
    />
  )
}

const SelectSeparator: ComponentType<SelectSeparatorProps> = SelectSeparatorImpl

/**
 * 항목 글자는 `Select.ItemText`로 감싸야 trigger의 `Select.Value`에 같은 글자가 보인다.
 */
export const Select = {
  Root: BaseSelect.Root,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Popup: SelectPopup,
  Item: SelectItem,
  ItemText: BaseSelect.ItemText,
  Group: BaseSelect.Group,
  GroupLabel: SelectGroupLabel,
  Separator: SelectSeparator
}
