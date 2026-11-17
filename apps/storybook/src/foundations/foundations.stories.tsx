import type { Meta, StoryObj } from '@storybook/react-vite'
import themeSource from '@dfragon/design/theme.css?raw'
import {
  ColorTokens,
  MotionTokens,
  PrimitiveScale,
  RadiusTokens,
  Section,
  ShadowTokens,
  SpacingTokens,
  TypographyTokens,
  ValueTokens
} from './sections'
import { readThemeTokens, tokensIn } from './theme-tokens'

const tokens = readThemeTokens(themeSource)
const colorTokens = tokensIn(tokens, 'color')
const primitiveTokens = colorTokens.filter((token) => token.name.startsWith('--gray-'))
const gradientTokens = colorTokens.filter((token) => token.name.startsWith('--gradient-'))
const roleColorTokens = colorTokens.filter((token) => token.name.startsWith('--color-'))

const meta = {
  title: 'Foundations'
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Color: Story = {
  render: () => (
    <div className="grid gap-10">
      <Section title="원색 단계">
        <PrimitiveScale tokens={primitiveTokens} />
      </Section>
      <Section title="역할 색">
        <ColorTokens tokens={roleColorTokens} all={tokens} />
      </Section>
      <Section title="그라데이션">
        <ColorTokens tokens={gradientTokens} all={tokens} />
      </Section>
    </div>
  )
}

export const Typography: Story = {
  render: () => (
    <Section title="글자">
      <TypographyTokens tokens={tokensIn(tokens, 'typography')} />
    </Section>
  )
}

export const Spacing: Story = {
  render: () => (
    <Section title="간격">
      <SpacingTokens tokens={tokensIn(tokens, 'spacing')} />
    </Section>
  )
}

export const Radius: Story = {
  render: () => (
    <Section title="Radius">
      <RadiusTokens tokens={tokensIn(tokens, 'radius')} />
    </Section>
  )
}

export const Layer: Story = {
  render: () => (
    <Section title="z-index">
      <ValueTokens tokens={tokensIn(tokens, 'layer')} />
    </Section>
  )
}

export const Breakpoint: Story = {
  render: () => (
    <Section title="Breakpoint">
      <ValueTokens tokens={tokensIn(tokens, 'breakpoint')} />
    </Section>
  )
}

export const Shadow: Story = {
  render: () => (
    <Section title="그림자">
      <ShadowTokens tokens={tokensIn(tokens, 'shadow')} />
    </Section>
  )
}

export const Motion: Story = {
  render: () => (
    <Section title="모션">
      <MotionTokens tokens={tokensIn(tokens, 'motion')} />
    </Section>
  )
}
