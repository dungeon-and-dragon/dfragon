import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { uiNotices } from '@dfragon/licenses/vite'

function isExternal(id: string) {
  const isBaseUi = id === '@base-ui/react' || id.startsWith('@base-ui/react/')
  const isReact = id === 'react' || id.startsWith('react/')
  const isReactDom = id === 'react-dom' || id.startsWith('react-dom/')
  const isPeer = isBaseUi || isReact || isReactDom

  return isPeer
}

export default defineConfig({
  plugins: [react(), uiNotices()],
  build: {
    lib: {
      entry: { index: 'src/index.tsx' },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rolldownOptions: { external: isExternal }
  }
})
