import type { ReactNode, SVGProps } from 'react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>
export type FillableIconProps = IconProps & { filled?: boolean }

function LineIcon({ children, ...props }: IconProps & { children: ReactNode }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="m6 9 6 6 6-6" />
    </LineIcon>
  )
}

export function ChevronLeftIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="m15 18-6-6 6-6" />
    </LineIcon>
  )
}

export function ChevronRightIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="m9 18 6-6-6-6" />
    </LineIcon>
  )
}

export function ArrowRightIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="M4 12h16M14 6l6 6-6 6" />
    </LineIcon>
  )
}

export function CheckIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="M20 6 9 17l-5-5" />
    </LineIcon>
  )
}

export function CloseIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="M6 6l12 12M18 6 6 18" />
    </LineIcon>
  )
}

export function MinusIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="M5 12h14" />
    </LineIcon>
  )
}

export function PlusIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="M5 12h14M12 5v14" />
    </LineIcon>
  )
}

export function SearchIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <circle vectorEffect="non-scaling-stroke" cx="11" cy="11" r="7" />
      <path vectorEffect="non-scaling-stroke" d="m20 20-4-4" />
    </LineIcon>
  )
}

export function RefreshIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path
        vectorEffect="non-scaling-stroke"
        d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
      />
      <path vectorEffect="non-scaling-stroke" d="M21 3v5h-5" />
      <path
        vectorEffect="non-scaling-stroke"
        d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
      />
      <path vectorEffect="non-scaling-stroke" d="M8 16H3v5" />
    </LineIcon>
  )
}

export function ExternalLinkIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="M14 4h6v6M20 4 10 14M18 14v6H4V6h6" />
    </LineIcon>
  )
}

export function CopyIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <rect vectorEffect="non-scaling-stroke" x="9" y="9" width="12" height="12" />
      <path vectorEffect="non-scaling-stroke" d="M15 5V3H3v12h2" />
    </LineIcon>
  )
}

export function ViewfinderIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path vectorEffect="non-scaling-stroke" d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
      <circle vectorEffect="non-scaling-stroke" cx="12" cy="12" r="3" />
    </LineIcon>
  )
}

export function MonitorIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <rect vectorEffect="non-scaling-stroke" x="3" y="4" width="18" height="12" rx="1.5" />
      <path vectorEffect="non-scaling-stroke" d="M8 20h8M12 16v4" />
    </LineIcon>
  )
}

export function SunIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle vectorEffect="non-scaling-stroke" cx="12" cy="12" r="4" />
      <path
        vectorEffect="non-scaling-stroke"
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </LineIcon>
  )
}

export function MoonIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path
        vectorEffect="non-scaling-stroke"
        d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      />
    </LineIcon>
  )
}

export function HeartIcon({ filled = false, ...props }: FillableIconProps): React.JSX.Element {
  return (
    <LineIcon
      fill={filled ? 'currentColor' : 'none'}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path
        vectorEffect="non-scaling-stroke"
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"
      />
    </LineIcon>
  )
}

export function PinIcon({ filled = false, ...props }: FillableIconProps): React.JSX.Element {
  return (
    <LineIcon fill={filled ? 'currentColor' : 'none'} {...props}>
      <g transform="translate(-1.4 1.4) rotate(45 12 12)">
        <path vectorEffect="non-scaling-stroke" d="M9 3h6v7l3 4H6l3-4z" />
        <path vectorEffect="non-scaling-stroke" d="M8 3h8M12 14v7" />
      </g>
    </LineIcon>
  )
}
