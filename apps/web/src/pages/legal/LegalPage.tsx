import * as stylex from '@stylexjs/stylex'
import { useId } from 'react'
import { styles } from './LegalPage.style'

export function TermsPage(): React.JSX.Element {
  return <LegalPage title="이용약관" />
}

export function PrivacyPage(): React.JSX.Element {
  return <LegalPage title="개인정보처리방침" />
}

function LegalPage({ title }: { title: string }): React.JSX.Element {
  const titleId = useId()

  return (
    <div {...stylex.props(styles.screen)}>
      <article aria-labelledby={titleId} {...stylex.props(styles.box)}>
        <div {...stylex.props(styles.header)}>
          <h1 id={titleId} {...stylex.props(styles.title)}>
            {title}
          </h1>
        </div>
        <div {...stylex.props(styles.body)} />
      </article>
    </div>
  )
}
