import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ImageChipGroup, type ImageChipSprite } from './image-chip-group'

const COLORS = ['#7a2e2e', '#2e4f7a', '#3d6b3a', '#6b4f8a', '#8a6a2e']
const SHEET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="550" height="50">${COLORS.map(
  (color, index) => `<rect x="${index * 110}" width="110" height="50" fill="${color}"/>`
).join('')}</svg>`
const SHEET = `data:image/svg+xml,${encodeURIComponent(SHEET_SVG)}`

function cell(index: number): ImageChipSprite {
  return { src: SHEET, sheetWidth: 550, x: index * 110, y: 0, width: 110, height: 50 }
}

const ITEMS = [
  { value: 'first', label: '첫째', image: cell(0) },
  { value: 'second', label: '둘째', image: cell(1), badge: cell(2) },
  { value: 'third', label: '셋째', image: cell(3) },
  { value: 'text', label: '그림 없음' }
]

const meta = {
  title: 'Components/ImageChipGroup',
  component: ImageChipGroup,
  args: {
    items: ITEMS,
    value: 'first',
    'aria-label': '종류',
    deselectable: true,
    onValueChange: () => {}
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)

    return <ImageChipGroup {...args} value={value} onValueChange={setValue} />
  }
} satisfies Meta<typeof ImageChipGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
