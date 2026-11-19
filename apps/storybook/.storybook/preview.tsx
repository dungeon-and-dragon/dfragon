import type { Preview } from '@storybook/react-vite'
import { setupWorker } from 'msw/browser'
import { mswLoader } from 'msw-storybook-addon/csf3'
import './preview.css'

const preview: Preview = {
  globalTypes: {
    colorMode: {
      description: '색 모드',
      toolbar: {
        title: '색 모드',
        items: [
          { value: 'light', title: '라이트' },
          { value: 'dark', title: '다크' }
        ],
        dynamicTitle: true
      }
    }
  },
  initialGlobals: { colorMode: 'light' },
  // story는 parameters.msw의 handler로 API 응답을 정한다. 캐릭터 이미지 같은 그 밖의 요청은 그대로 보낸다.
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker()
      await worker.start({ onUnhandledFrame: 'bypass', quiet: true })

      return worker
    })
  ],
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.colorMode = context.globals.colorMode

      return <Story />
    }
  ],
  parameters: {
    layout: 'padded',
    options: { storySort: { order: ['Foundations', 'Components', 'Patterns', 'Screens'] } }
  }
}

export default preview
