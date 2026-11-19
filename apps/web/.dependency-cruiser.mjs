const WEB_SOURCE_PATH = '^src/'
const PAGES_PATH = '^src/pages/'
const SCREEN_FOLDER_PATH = '^src/pages/[^/]+/'
const SCREEN_INDEX_PATH = '^src/pages/[^/]+/index\\.ts$'
const CORE_PATH = '^src/core/'
const CORE_DOMAIN_SOURCE_PATH = '^src/core/[^/]+/.*\\.[cm]?[jt]sx?$'
const CORE_INDEX_PATH = '^src/core/[^/]+/index\\.ts$'
const SCREEN_FOLDER_IMPORT_COMMENT =
  '화면 폴더 밖에서는 #pages/<화면>(예: #pages/rankings)처럼 폴더 경로로 import한다. 두 화면이 쓰는 코드는 공용 components/나 hooks/에 옮긴다.'
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
const LEGACY_FOLDERS_PATH = '^src/(components|hooks|core|host|lib)/'
const LAYER_IMPORT_COMMENT =
  '계층은 자기보다 아래 계층만 import한다. 위에서부터 app, pages, widgets, features, entities, shared다.'
const SLICE_IMPORT_COMMENT =
  '같은 계층의 다른 슬라이스는 import하지 않는다. 두 슬라이스가 쓰는 코드는 아래 계층으로 내린다. entity 사이는 entities/<A>/@x/<B>.ts로만 가져온다.'
// 화면끼리 import하는 지금 코드는 #1822, #1823이 옮기거나 지울 때까지 예외로 둔다.
const PAGE_SLICE_EXCEPTIONS = {
  home: ['rankings', 'character-search', 'not-found', 'legal'],
  search: ['party', 'raid'],
  multisearch: ['party', 'raid', 'search'],
  stats: ['rankings']
}

function upperLayerRules() {
  return LAYERS.slice(1).map((layer, index) => ({
    name: 'layer-imports',
    comment: LAYER_IMPORT_COMMENT,
    severity: 'error',
    from: { path: `^src/${layer}/` },
    to: { path: `^src/(${LAYERS.slice(0, index + 1).join('|')})/` }
  }))
}

function sliceRule(layer, from, allowed = [], toPath = `^src/${layer}/`) {
  return {
    name: 'slice-imports',
    comment: SLICE_IMPORT_COMMENT,
    severity: 'error',
    from,
    to: { path: toPath, pathNot: [`^src/${layer}/$1/`, ...allowed] }
  }
}

// 다른 화면의 안쪽 파일 import는 screen-folder-imports가 막으므로 같은 import를 두 번 알리지 않게 index.ts만 본다.
function pageSliceRules() {
  const excepted = Object.keys(PAGE_SLICE_EXCEPTIONS)

  return [
    sliceRule(
      'pages',
      { path: '^src/pages/([^/]+)/', pathNot: `^src/pages/(${excepted.join('|')})/` },
      [],
      SCREEN_INDEX_PATH
    ),
    ...Object.entries(PAGE_SLICE_EXCEPTIONS).map(([page, imported]) =>
      sliceRule(
        'pages',
        { path: `^src/pages/(${page})/` },
        [`^src/pages/(${imported.join('|')})/index\\.ts$`],
        SCREEN_INDEX_PATH
      )
    )
  ]
}

function slicePublicApiRules() {
  return ['widgets', 'features', 'entities'].map((layer) => ({
    name: 'slice-index',
    comment: `슬라이스 밖에서는 #${layer}/<슬라이스>처럼 그 슬라이스의 index.ts로 import한다.`,
    severity: 'error',
    from: { path: WEB_SOURCE_PATH, pathNot: `^src/${layer}/` },
    to: { path: `^src/${layer}/[^/]+/`, pathNot: `^src/${layer}/[^/]+/index\\.ts$` }
  }))
}

export default {
  forbidden: [
    ...upperLayerRules(),
    ...pageSliceRules(),
    sliceRule('widgets', { path: '^src/widgets/([^/]+)/' }),
    sliceRule('features', { path: '^src/features/([^/]+)/' }),
    sliceRule('entities', { path: '^src/entities/([^/]+)/' }, ['^src/entities/[^/]+/@x/$1\\.ts$']),
    ...slicePublicApiRules(),
    {
      name: 'shared-legacy-imports',
      comment:
        'shared는 옛 폴더(components, hooks, core, host, lib)를 import하지 않는다. 옛 폴더의 코드가 필요하면 그 코드를 shared로 내리거나 위 계층에 둔다.',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: LEGACY_FOLDERS_PATH }
    },
    {
      name: 'legacy-layer-imports',
      comment: '옛 폴더(components, hooks, core, host, lib)는 app과 pages를 import하지 않는다.',
      severity: 'error',
      from: { path: LEGACY_FOLDERS_PATH },
      to: { path: '^src/(app|pages)/' }
    },
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
