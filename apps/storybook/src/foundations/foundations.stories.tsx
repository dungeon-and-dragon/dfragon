import type { Meta, StoryObj } from '@storybook/react-vite'
import themeSource from '@dfragon/design/theme.css?raw'
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  ExternalLinkIcon,
  HeartIcon,
  MinusIcon,
  MonitorIcon,
  MoonIcon,
  PinIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SunIcon,
  ViewfinderIcon
} from '@dfragon/ui'
import {
  ClassSamples,
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
  { name: 'ArrowRightIcon', Icon: ArrowRightIcon },
  { name: 'CheckIcon', Icon: CheckIcon },
  { name: 'ChevronDownIcon', Icon: ChevronDownIcon },
  { name: 'ChevronRightIcon', Icon: ChevronRightIcon },
  { name: 'CloseIcon', Icon: CloseIcon },
  { name: 'CopyIcon', Icon: CopyIcon },
  { name: 'ExternalLinkIcon', Icon: ExternalLinkIcon },
  { name: 'HeartIcon', Icon: HeartIcon },
  { name: 'HeartIcon filled', Icon: HeartIcon, props: { filled: true } },
  { name: 'MinusIcon', Icon: MinusIcon },
  { name: 'MonitorIcon', Icon: MonitorIcon },
  { name: 'MoonIcon', Icon: MoonIcon },
  { name: 'PinIcon', Icon: PinIcon },
  { name: 'PinIcon filled', Icon: PinIcon, props: { filled: true } },
  { name: 'PlusIcon', Icon: PlusIcon },
  { name: 'RefreshIcon', Icon: RefreshIcon },
  { name: 'SearchIcon', Icon: SearchIcon },
  { name: 'SunIcon', Icon: SunIcon },
  { name: 'ViewfinderIcon', Icon: ViewfinderIcon }
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

export const NumberText: Story = {
  name: 'Number',
  render: () => (
    <Section title="숫자">
      <ClassSamples
        samples={[
          { name: 'num', sample: <span className="num">98,412</span> },
          {
            name: 'num text-xs',
            sample: <span className="num text-xs text-fg-subtle">Lv 115</span>
          },
          {
            name: 'num font-semibold',
            sample: <span className="num font-semibold text-game-fame">98,412</span>
          }
        ]}
      />
    </Section>
  )
}

export const Stat: Story = {
  render: () => (
    <Section title="요약 숫자와 라벨">
      <ClassSamples
        samples={[
          {
            name: 'stat',
            sample: (
              <dl className="flex gap-8">
                <div className="stat">
                  <dt className="stat-label">클리어율</dt>
                  <dd className="stat-value">82%</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">명성</dt>
                  <dd className="stat-value text-game-fame">98,412</dd>
                </div>
              </dl>
            )
          },
          { name: 'label', sample: <span className="label">마지막 갱신</span> }
        ]}
      />
    </Section>
  )
}

export const Portrait: Story = {
  render: () => (
    <Section title="초상화 틀">
      <ClassSamples
        samples={[
          { name: 'portrait portrait-sm', sample: <span className="portrait portrait-sm" /> },
          { name: 'portrait portrait-md', sample: <span className="portrait portrait-md" /> },
          { name: 'portrait portrait-lg', sample: <span className="portrait portrait-lg" /> }
        ]}
      />
    </Section>
  )
}

export const Link: Story = {
  render: () => (
    <Section title="텍스트 링크">
      <ClassSamples
        samples={[
          {
            name: 'link',
            sample: (
              <>
                <a className="link font-semibold" href="#link">
                  캐릭터1
                </a>
                <a className="link text-fg-adventure" href="#link">
                  모험단1
                </a>
                <a className="link text-fg-guild" href="#link">
                  길드1
                </a>
              </>
            )
          }
        ]}
      />
    </Section>
  )
}

export const Skeleton: Story = {
  render: () => (
    <Section title="Skeleton">
      <ClassSamples
        samples={[
          { name: 'skeleton portrait-sm', sample: <span className="skeleton portrait-sm" /> },
          { name: 'skeleton-text', sample: <span className="skeleton-text w-[88px]" /> },
          {
            name: 'skeleton-text skeleton-text-xs',
            sample: <span className="skeleton-text skeleton-text-xs w-[40px]" />
          }
        ]}
      />
    </Section>
  )
}
