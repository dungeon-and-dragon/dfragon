import type { Meta, StoryObj } from '@storybook/react-vite'
import { Typo, typographyVariants, type TypoVariant } from './typo'

const VARIANTS = Object.keys(typographyVariants) as TypoVariant[]

const meta = {
  title: 'Components/Typo',
  component: Typo.txtM,
  args: { children: '던전앤파이터 캐릭터 0123456789' },
  argTypes: { children: { control: 'text' } }
} satisfies Meta<typeof Typo.txtM>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: (args) => (
    <div className="grid gap-3 text-fg">
      {VARIANTS.map((variant) => {
        const Variant = Typo[variant]

        return (
          <div key={variant} className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-4">
            <code className="font-mono text-xs text-fg-subtle">{variant}</code>
            <Variant>{args.children}</Variant>
          </div>
        )
      })}
    </div>
  )
}
