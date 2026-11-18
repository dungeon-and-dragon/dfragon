import type { Meta, StoryObj } from '@storybook/react-vite'
import themeSource from '@dfragon/design/theme.css?raw'
import {
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  ExternalLinkIcon,
  MonitorIcon,
  MoonIcon,
  PinIcon,
  RefreshIcon,
  SearchIcon,
  StarIcon,
  SunIcon
} from '@dfragon/ui'
import {
  ColorTokens,
  HeightTokens,
  IconSet,
  MotionTokens,
  PrimitiveScale,
  RadiusTokens,
  Section,
  ShadowTokens,
  SpacingTokens,
  SquareTokens,
  TypographyTokens,
  ValueTokens
} from './sections'
import { readThemeTokens, tokensIn } from './theme-tokens'

const tokens = readThemeTokens(themeSource)
const colorTokens = tokensIn(tokens, 'color')
const primitiveTokens = colorTokens.filter((token) => token.name.startsWith('--gray-'))
const gradientTokens = colorTokens.filter((token) => token.name.startsWith('--gradient-'))
const roleColorTokens = colorTokens.filter((token) => token.name.startsWith('--color-'))
const sizeTokens = tokensIn(tokens, 'size')
const heightTokens = sizeTokens.filter((token) => token.name.startsWith('--height-'))
const containerTokens = sizeTokens.filter((token) => token.name.startsWith('--container-'))
const iconTokens = sizeTokens.filter((token) => token.name.startsWith('--size-'))
const iconSizeTokens = iconTokens.filter((token) => token.name.startsWith('--size-icon-'))
const ICONS = [
  { name: 'CameraIcon', Icon: CameraIcon },
  { name: 'CheckIcon', Icon: CheckIcon },
  { name: 'ChevronDownIcon', Icon: ChevronDownIcon },
  { name: 'ChevronRightIcon', Icon: ChevronRightIcon },
  { name: 'CloseIcon', Icon: CloseIcon },
  { name: 'CopyIcon', Icon: CopyIcon },
  { name: 'ExternalLinkIcon', Icon: ExternalLinkIcon },
  { name: 'MonitorIcon', Icon: MonitorIcon },
  { name: 'MoonIcon', Icon: MoonIcon },
  { name: 'PinIcon', Icon: PinIcon },
  { name: 'PinIcon filled', Icon: PinIcon, props: { filled: true } },
  { name: 'RefreshIcon', Icon: RefreshIcon },
  { name: 'SearchIcon', Icon: SearchIcon },
  { name: 'StarIcon', Icon: StarIcon },
  { name: 'StarIcon filled', Icon: StarIcon, props: { filled: true } },
  { name: 'SunIcon', Icon: SunIcon }
] as const

const meta = {
  title: 'Foundations'
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Color: Story = {
  render: () => (
    <div className="grid gap-12">
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

export const Size: Story = {
  render: () => (
    <div className="grid gap-12">
      <Section title="높이">
        <HeightTokens tokens={heightTokens} />
      </Section>
      <Section title="아이콘">
        <SquareTokens tokens={iconTokens} />
      </Section>
      <Section title="컨테이너 폭">
        <ValueTokens tokens={containerTokens} />
      </Section>
    </div>
  )
}

export const Icon: Story = {
  render: () => (
    <Section title="아이콘">
      <IconSet icons={ICONS} sizes={iconSizeTokens} />
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
