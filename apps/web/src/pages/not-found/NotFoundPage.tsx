import { Link, useLocation, useRouter } from '@tanstack/react-router'

export function NotFoundPage(): React.JSX.Element {
  const href = useLocation({ select: (location) => location.href })
  const { host } = new URL(useRouter().origin)

  return (
    <div className="section box-border flex min-h-[360px] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <p className="m-0 text-xs break-all text-fg-muted">{`${host}${href}`}</p>
      <h1 className="screen-title">없는 주소입니다.</h1>
      <Link to="/" className="btn btn-primary btn-lg no-underline">
        첫 화면으로
      </Link>
    </div>
  )
}
