import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { lazy, Suspense } from 'react'
import { styles } from './App.style'

// 웹 앱은 Base UI와 카드 묶음이 커서 빈 전역 바를 먼저 그린 뒤 받는다.
const WebClient = lazy(() => import('./WebClient'))

export default function App(): React.JSX.Element {
  return (
    <div {...stylex.props(styles.page)}>
      <Suspense fallback={<div {...stylex.props(styles.appPending)} />}>
        <WebClient />
      </Suspense>
      <span {...stylex.props(styles.buildCommit)}>
        <span {...stylex.props(shapes.srOnly)}>빌드 </span>
        {__BUILD_COMMIT__}
      </span>
    </div>
  )
}
