import { useId } from 'react'

export function TermsPage(): React.JSX.Element {
  return <LegalPage title="이용약관" />
}

export function PrivacyPage(): React.JSX.Element {
  return <LegalPage title="개인정보처리방침" />
}

function LegalPage({ title }: { title: string }): React.JSX.Element {
  const titleId = useId()

  return (
    <div className="p-4">
      <article aria-labelledby={titleId} className="rounded-panel border border-line bg-canvas">
        <div className="flex min-h-11 items-center border-b border-line px-4">
          <h1 id={titleId} className="m-0 text-base font-semibold">
            {title}
          </h1>
        </div>
        <div className="min-h-120" />
      </article>
    </div>
  )
}
