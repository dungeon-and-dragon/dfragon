import { Link, useLocation } from '@tanstack/react-router'

export function NotFoundPage(): React.JSX.Element {
  const href = useLocation({ select: (location) => location.href })

  return (
    <div className="box-border flex min-h-90 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <p className="m-0 text-xs break-all text-fg-muted">{`${window.location.host}${href}`}</p>
      <h1 className="m-0 text-xl font-semibold tracking-heading">없는 주소입니다.</h1>
      <Link to="/" className="btn btn-primary btn-lg no-underline">
        첫 화면으로
      </Link>
    </div>
  )
}
