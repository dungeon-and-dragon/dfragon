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

export function ChevronRightIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path vectorEffect="non-scaling-stroke" d="m9 18 6-6-6-6" />
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

export function CameraIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path
        vectorEffect="non-scaling-stroke"
        d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"
      />
      <circle vectorEffect="non-scaling-stroke" cx="12" cy="13" r="3" />
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
    <LineIcon {...props}>
      <polygon vectorEffect="non-scaling-stroke" points="12 7 17 12 12 17 7 12" />
      <path vectorEffect="non-scaling-stroke" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      <path
        vectorEffect="non-scaling-stroke"
        d="m5 5 1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"
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

export function StarIcon({ filled = false, ...props }: FillableIconProps): React.JSX.Element {
  return (
    <LineIcon fill={filled ? 'currentColor' : 'none'} {...props}>
      <path
        vectorEffect="non-scaling-stroke"
        d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"
      />
    </LineIcon>
  )
}

export function PinIcon({ filled = false, ...props }: FillableIconProps): React.JSX.Element {
  return (
    <LineIcon fill={filled ? 'currentColor' : 'none'} {...props}>
      <path vectorEffect="non-scaling-stroke" d="M12 17v5" />
      <path
        vectorEffect="non-scaling-stroke"
        d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
      />
    </LineIcon>
  )
}
