import { type CSSProperties, type ReactNode, useState } from 'react'
import { modeValues, type ThemeToken } from './theme-tokens'

type ColorScheme = 'light' | 'dark'

const COLOR_SCHEMES: readonly { scheme: ColorScheme; label: string }[] = [
  { scheme: 'light', label: '라이트' },
  { scheme: 'dark', label: '다크' }
]
const TYPE_SAMPLE = '던전앤파이터 캐릭터 0123456789 DFragon'
const CUBIC_BEZIER_PATTERN = /^cubic-bezier\(([^)]+)\)$/u

function TokenName({ token }: { token: ThemeToken }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <code className="font-mono text-xs text-fg">{token.name}</code>
      {token.note !== null && <span className="text-xs text-fg-muted">{token.note}</span>}
    </div>
  )
}

function TokenValue({ children }: { children: ReactNode }) {
  return <code className="font-mono text-xs break-all text-fg-subtle">{children}</code>
}

function TokenRows({ children }: { children: ReactNode }) {
  return <div className="grid divide-y divide-line border-y border-line">{children}</div>
}

function TokenRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,16rem)_minmax(0,1fr)] items-center gap-4 py-3">
      {children}
    </div>
  )
}

function SchemeSample({ scheme, children }: { scheme: ColorScheme; children: ReactNode }) {
  return (
    <div style={{ colorScheme: scheme }} className="bg-canvas p-3 text-fg">
      {children}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 text-fg">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function PrimitiveScale({ tokens }: { tokens: readonly ThemeToken[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
      {tokens.map((token) => (
        <div key={token.name} className="grid gap-1">
          <div className="h-12 border border-line" style={{ background: `var(${token.name})` }} />
          <code className="font-mono text-xs text-fg">{token.name}</code>
          <TokenValue>{token.value}</TokenValue>
        </div>
      ))}
    </div>
  )
}

export function ColorTokens({
  tokens,
  all
}: {
  tokens: readonly ThemeToken[]
  all: readonly ThemeToken[]
}) {
  return (
    <TokenRows>
      {tokens.map((token) => {
        const values = modeValues(token.value, all)

        return (
          <TokenRow key={token.name}>
            <TokenName token={token} />
            <div className="grid grid-cols-2 gap-2">
              {COLOR_SCHEMES.map(({ scheme, label }) => (
                <SchemeSample key={scheme} scheme={scheme}>
                  <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
                    <div
                      className="h-8 border border-line"
                      style={{ background: `var(${token.name})` }}
                    />
                    <div className="grid gap-0.5">
                      <span className="text-xs text-fg-muted">{label}</span>
                      <TokenValue>{values[scheme]}</TokenValue>
                    </div>
                  </div>
                </SchemeSample>
              ))}
            </div>
          </TokenRow>
        )
      })}
    </TokenRows>
  )
}

function typographySampleStyle(name: string): CSSProperties {
  const value = `var(${name})`

  if (name.startsWith('--font-weight-')) {
    return { fontWeight: value }
  }

  if (name.startsWith('--font-')) {
    return { fontFamily: value }
  }

  if (name.startsWith('--leading-') || name.endsWith('--line-height')) {
    return { lineHeight: value }
  }

  if (name.startsWith('--tracking-') || name.endsWith('--letter-spacing')) {
    return { letterSpacing: value }
  }

  if (name.endsWith('--font-weight')) {
    return { fontWeight: value }
  }

  const lineHeight = `var(${name}--line-height, normal)`

  return { fontSize: value, lineHeight }
}

export function TypographyTokens({ tokens }: { tokens: readonly ThemeToken[] }) {
  return (
    <TokenRows>
      {tokens.map((token) => (
        <TokenRow key={token.name}>
          <TokenName token={token} />
          <div className="grid gap-1">
            <span style={typographySampleStyle(token.name)}>{TYPE_SAMPLE}</span>
            <TokenValue>{token.value}</TokenValue>
          </div>
        </TokenRow>
      ))}
    </TokenRows>
  )
}

export function SpacingTokens({ tokens }: { tokens: readonly ThemeToken[] }) {
  return (
    <TokenRows>
      {tokens.map((token) => (
        <TokenRow key={token.name}>
          <TokenName token={token} />
          <div className="flex items-center gap-3">
            <div className="h-4 shrink-0 bg-signal" style={{ width: `var(${token.name})` }} />
            <TokenValue>{token.value}</TokenValue>
          </div>
        </TokenRow>
      ))}
    </TokenRows>
  )
}

export function ValueTokens({ tokens }: { tokens: readonly ThemeToken[] }) {
  return (
    <TokenRows>
      {tokens.map((token) => (
        <TokenRow key={token.name}>
          <TokenName token={token} />
          <TokenValue>{token.value}</TokenValue>
        </TokenRow>
      ))}
    </TokenRows>
  )
}

export function RadiusTokens({ tokens }: { tokens: readonly ThemeToken[] }) {
  return (
    <TokenRows>
      {tokens.map((token) => (
        <TokenRow key={token.name}>
          <TokenName token={token} />
          <div className="flex items-center gap-3">
            <div
              className="size-12 border-2 border-signal bg-control"
              style={{ borderRadius: `var(${token.name})` }}
            />
            <TokenValue>{token.value}</TokenValue>
          </div>
        </TokenRow>
      ))}
    </TokenRows>
  )
}

export function ShadowTokens({ tokens }: { tokens: readonly ThemeToken[] }) {
  return (
    <TokenRows>
      {tokens.map((token) => (
        <TokenRow key={token.name}>
          <TokenName token={token} />
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              {COLOR_SCHEMES.map(({ scheme, label }) => (
                <SchemeSample key={scheme} scheme={scheme}>
                  <div
                    className="flex h-16 items-center justify-center bg-surface text-xs text-fg-muted"
                    style={{ boxShadow: `var(${token.name})` }}
                  >
                    {label}
                  </div>
                </SchemeSample>
              ))}
            </div>
            <TokenValue>{token.value}</TokenValue>
          </div>
        </TokenRow>
      ))}
    </TokenRows>
  )
}

function EasingCurve({ value }: { value: string }) {
  const points = CUBIC_BEZIER_PATTERN.exec(value)?.[1]?.split(',').map(Number)

  if (points?.length !== 4) {
    return null
  }

  const [x1, y1, x2, y2] = points.map((point) => point * 100)

  return (
    <svg viewBox="-4 -4 108 108" className="size-24 overflow-visible" aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" fill="none" className="stroke-line" />
      <path
        d={`M0 100 C${x1} ${100 - y1}, ${x2} ${100 - y2}, 100 0`}
        fill="none"
        strokeWidth="2"
        className="stroke-signal"
      />
    </svg>
  )
}

function useToggle(): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const toggle = () => setOn((current) => !current)

  return [on, toggle]
}

function PlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 shrink-0 cursor-pointer border border-line-strong bg-control px-3 text-xs text-fg"
    >
      재생
    </button>
  )
}

function MotionTrack({ moved, transition }: { moved: boolean; transition: string }) {
  const transform = moved ? 'translateX(calc(100cqw - 100%))' : 'none'

  return (
    <div className="relative h-6 min-w-0 flex-1 bg-inset [container-type:inline-size]">
      <div
        className="absolute top-0 left-0 size-6 bg-signal"
        style={{
          transform,
          transition: `transform ${transition}`
        }}
      />
    </div>
  )
}

function EasingRow({ token }: { token: ThemeToken }) {
  const [moved, toggle] = useToggle()

  return (
    <TokenRow>
      <TokenName token={token} />
      <div className="flex items-center gap-4">
        <EasingCurve value={token.value} />
        <div className="grid min-w-0 flex-1 gap-2">
          <MotionTrack moved={moved} transition={`var(--duration-state) var(${token.name})`} />
          <TokenValue>{token.value}</TokenValue>
        </div>
        <PlayButton onClick={toggle} />
      </div>
    </TokenRow>
  )
}

function DurationRow({ token, easing }: { token: ThemeToken; easing: string | undefined }) {
  const [moved, toggle] = useToggle()
  const transition =
    easing !== undefined ? `var(${token.name}) var(${easing})` : `var(${token.name})`

  return (
    <TokenRow>
      <TokenName token={token} />
      <div className="flex items-center gap-4">
        <div className="grid min-w-0 flex-1 gap-2">
          <MotionTrack moved={moved} transition={transition} />
          <TokenValue>{token.value}</TokenValue>
        </div>
        <PlayButton onClick={toggle} />
      </div>
    </TokenRow>
  )
}

function LoopRow({ token }: { token: ThemeToken }) {
  return (
    <TokenRow>
      <TokenName token={token} />
      <div className="flex items-center gap-4">
        <div
          className="size-4 shrink-0 animate-pulse bg-signal"
          style={{ animationDuration: `var(${token.name})` }}
        />
        <TokenValue>{token.value}</TokenValue>
      </div>
    </TokenRow>
  )
}

export function MotionTokens({ tokens }: { tokens: readonly ThemeToken[] }) {
  const easing = tokens.find((token) => token.name.startsWith('--ease-'))?.name

  return (
    <TokenRows>
      {tokens.map((token) => {
        if (token.name.startsWith('--ease-')) {
          return <EasingRow key={token.name} token={token} />
        }

        if (token.name.startsWith('--duration-')) {
          return <DurationRow key={token.name} token={token} easing={easing} />
        }

        return <LoopRow key={token.name} token={token} />
      })}
    </TokenRows>
  )
}
