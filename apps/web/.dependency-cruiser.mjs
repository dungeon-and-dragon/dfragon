const WEB_SOURCE_PATH = '^src/'
const PAGES_PATH = '^src/pages/'
const SCREEN_FOLDER_PATH = '^src/pages/[^/]+/'
const SCREEN_INDEX_PATH = '^src/pages/[^/]+/index\\.ts$'
const SCREEN_FOLDER_IMPORT_COMMENT =
  '화면 폴더 밖에서는 pages/<화면>(예: pages/rankings)처럼 폴더 경로로 import한다. 두 화면이 쓰는 코드는 공용 components/나 hooks/에 옮긴다.'

export default {
  forbidden: [
    {
      name: 'screen-folder-imports',
      comment: SCREEN_FOLDER_IMPORT_COMMENT,
      severity: 'error',
      from: { path: '^src/pages/([^/]+)/' },
      to: {
        path: PAGES_PATH,
        pathNot: ['^src/pages/$1/', SCREEN_INDEX_PATH]
      }
    },
    {
      name: 'screen-folder-imports-outside-pages',
      comment: SCREEN_FOLDER_IMPORT_COMMENT,
      severity: 'error',
      from: { path: WEB_SOURCE_PATH, pathNot: SCREEN_FOLDER_PATH },
      to: {
        path: PAGES_PATH,
        pathNot: SCREEN_INDEX_PATH
      }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    doNotFollow: { path: ['node_modules', '^\\.\\./\\.\\./packages/'] }
  }
}
