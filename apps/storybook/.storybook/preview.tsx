import type { Preview } from '@storybook/react-vite'
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
