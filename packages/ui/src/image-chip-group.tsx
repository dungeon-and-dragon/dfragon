import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import type { CSSProperties } from 'react'

export type ImageChipSprite = Readonly<{
  src: string
  sheetWidth: number
  x: number
  y: number
  width: number
  height: number
}>

const CHIP_SIZE = { width: 110, height: 50 }
const BADGE_SIZE = { width: 16, height: 16 }

export type ImageChipGroupItem<Value extends string> = Readonly<{
  value: Value
  label: string
  image?: ImageChipSprite
  badge?: ImageChipSprite
}>

export type ImageChipGroupProps<Value extends string> = {
  items: readonly ImageChipGroupItem<Value>[]
  value: Value | null
  onValueChange: (value: Value | null) => void
  deselectable?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
}

function spriteStyle(
  { src, sheetWidth, x, y, width, height }: ImageChipSprite,
  box: Readonly<{ width: number; height: number }>
): CSSProperties {
  const scale = Math.max(box.width / width, box.height / height)
  const left = (box.width - width * scale) / 2 - x * scale
  const top = (box.height - height * scale) / 2 - y * scale
  const backgroundImage = `url(${src})`
  const backgroundSize = `${sheetWidth * scale}px auto`
  const backgroundPosition = `${left}px ${top}px`

  return { backgroundImage, backgroundSize, backgroundPosition }
}

export function ImageChipGroup<Value extends string>({
  items,
  value,
  onValueChange,
  deselectable = false,
  ...labelProps
}: ImageChipGroupProps<Value>): React.JSX.Element {
  function change([next]: Value[]): void {
    if (next !== undefined) {
      onValueChange(next)

      return
    }

    if (deselectable) {
      onValueChange(null)
    }
  }

  return (
    <ToggleGroup
      {...labelProps}
      value={value !== null ? [value] : []}
      onValueChange={change}
      className="image-chip-group"
    >
      {items.map(({ value: itemValue, label, image, badge }) => (
        <Toggle
          key={itemValue}
          value={itemValue}
          className="image-chip"
          data-image={image !== undefined ? '' : undefined}
          style={image !== undefined ? spriteStyle(image, CHIP_SIZE) : undefined}
        >
          {badge !== undefined && (
            <span className="image-chip-badge" style={spriteStyle(badge, BADGE_SIZE)} />
          )}
          <span className="image-chip-name">{label}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
