const WEB_SOURCE_PATH = '^src/'
const PAGES_PATH = '^src/pages/'
const SCREEN_FOLDER_PATH = '^src/pages/[^/]+/'
const SCREEN_INDEX_PATH = '^src/pages/[^/]+/index\\.ts$'
const CORE_PATH = '^src/core/'
const CORE_DOMAIN_SOURCE_PATH = '^src/core/[^/]+/.*\\.[cm]?[jt]sx?$'
const CORE_INDEX_PATH = '^src/core/[^/]+/index\\.ts$'
const SCREEN_FOLDER_IMPORT_COMMENT =
  '화면 폴더 밖에서는 #pages/<화면>(예: #pages/rankings)처럼 폴더 경로로 import한다. 두 화면이 쓰는 코드는 공용 components/나 hooks/에 옮긴다.'

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
    },
    {
      name: 'core-folder-index',
      comment:
        'core/ 밖에서는 #core/<도메인>(예: #core/character)으로 가져온다. 필요한 이름을 해당 도메인의 index.ts에서 명시적으로 다시 내보낸다. core/ 안의 도메인 사이는 파일을 직접 import한다.',
      severity: 'error',
      from: { path: WEB_SOURCE_PATH, pathNot: CORE_PATH },
      to: { path: CORE_DOMAIN_SOURCE_PATH, pathNot: CORE_INDEX_PATH }
    },
    {
      name: 'no-circular',
      comment:
        '실행할 때 생기는 순환 import를 두지 않는다. import type만으로 이은 순환은 검사하지 않는다. core/ 안의 도메인 사이는 index 대신 파일을 직접 import한다.',
      severity: 'error',
      from: { path: WEB_SOURCE_PATH },
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    doNotFollow: { path: ['node_modules', '^\\.\\./\\.\\./packages/'] }
  }
}
