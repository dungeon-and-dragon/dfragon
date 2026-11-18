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
    <article aria-labelledby={titleId} className="section">
      <h1 id={titleId} className="section-title">
        {title}
      </h1>
      <div className="min-h-[480px]" />
    </article>
  )
}
