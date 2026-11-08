import * as stylex from '@stylexjs/stylex'
import { useId } from 'react'
import { styles } from './LegalScreen.style'

export function TermsScreen(): React.JSX.Element {
  return <LegalScreen title="이용약관" />
}

export function PrivacyScreen(): React.JSX.Element {
  return <LegalScreen title="개인정보처리방침" />
}

function LegalScreen({ title }: { title: string }): React.JSX.Element {
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
