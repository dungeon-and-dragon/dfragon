export type SectionLink = Readonly<{ id: string; label: string }>

export function SectionNav({ links }: { links: readonly SectionLink[] }): React.JSX.Element {
  return (
    <nav
      aria-label="목차"
      className="min-w-0 border-line md:sticky md:top-[var(--summary-height)] max-md:order-first max-md:border-b"
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-4 text-sm max-md:flex-row max-md:gap-6 max-md:py-3">
        {links.map((link) => (
          <li key={link.id}>
            <SectionLinkItem link={link} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SectionLinkItem({ link: { id, label } }: { link: SectionLink }): React.JSX.Element {
  // 주소의 hash를 바꾸지 않고 옮겨 라우터의 주소 변경과 방문 기록을 건드리지 않는다.
  function moveTo(event: React.MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault()
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }

  return (
    <a href={`#${id}`} className="link text-fg-muted" onClick={moveTo}>
      {label}
    </a>
  )
}
