// Biome noRestrictedImports는 import type만 따로 허용하지 못해, 두 package의 값 import만 여기서 막는다.
// 계층 폴더 사이의 방향은 root biome.json이 검사한다.
const packageEntry = '^\\.\\./\\.\\./packages/(database|neople)/'
const apiSourcePath = '^src/'
const allowedApiSourcePath =
  '^src/(?:(domain|application|infrastructure|presentation|runtime)/|main\\.ts$)'
const featureFolderPath =
  '^src/(?:(?:domain|application|infrastructure)/[^/]+|presentation/http/[^/]+)/'

export default {
  forbidden: [
    ...[true, false].map((orphan) => {
      const name = orphan ? 'api-source-location-orphan' : 'api-source-location-connected'

      return {
        name,
        comment:
          'API source는 domain/, application/, infrastructure/, presentation/, runtime/에 둔다. 계층 폴더 밖에는 진입 파일 main.ts만 둔다.',
        severity: 'error',
        from: { path: apiSourcePath, pathNot: allowedApiSourcePath, orphan },
        to: {}
      }
    }),
    {
      name: 'domain-application-package-value',
      comment:
        'domain, application은 @dfragon/database, @dfragon/neople을 import type으로만 쓴다. 값이 필요한 코드는 infrastructure/database/, infrastructure/neople/에 두고 application/<기능>/ports.ts의 함수 타입으로 받는다.',
      severity: 'error',
      from: { path: '^src/(domain|application)/' },
      to: { path: packageEntry, dependencyTypesNot: ['type-only'] }
    },
    {
      name: 'presentation-package-value',
      comment:
        'presentation은 @dfragon/database, @dfragon/neople을 import type으로만 쓴다. DB, Neople 호출은 infrastructure/에 두고 application의 service를 거친다.',
      severity: 'error',
      from: { path: '^src/presentation/' },
      to: { path: packageEntry, dependencyTypesNot: ['type-only'] }
    },
    {
      name: 'feature-folder-index',
      comment:
        "기능 폴더(domain/<기능>/, application/<기능>/, infrastructure/<기술>/, presentation/http/<기능>/) 밖에서는 그 폴더의 index.js만 import한다. 필요한 이름을 그 폴더의 index.ts에 export { 이름 } from './파일.js'로 더하고 '../../application/<기능>/index.js'처럼 가져온다. application/<기능>/repository.ts, ports.ts는 infrastructure, runtime이 직접 import한다.",
      severity: 'error',
      // dependency-cruiser는 to의 $1을 from.path의 첫 group(가져오는 파일의 폴더)으로 바꾼다.
      from: { path: '^(src/.+)/[^/]+$' },
      to: {
        path: featureFolderPath,
        pathNot: [
          '^$1/[^/]+$',
          `${featureFolderPath}index\\.ts$`,
          '^src/application/[^/]+/(repository|ports)\\.ts$'
        ]
      }
    },
    {
      name: 'application-index-contract',
      comment:
        'application/<기능>/index.ts는 repository.ts, ports.ts를 다시 내보내지 않는다. presentation이 Repository와 port를 쓰지 못하게 막는 Biome 규칙이 import 경로로 판정하기 때문이다. 두 파일은 infrastructure, runtime이 파일을 직접 import한다.',
      severity: 'error',
      from: { path: '^src/application/[^/]+/index\\.ts$' },
      to: { path: '^src/application/[^/]+/(repository|ports)\\.ts$' }
    },
    {
      name: 'no-circular',
      comment:
        '실행할 때 생기는 순환 import를 두지 않는다. import type만으로 이은 순환은 검사하지 않는다. index.js를 거쳐 생긴 순환이면 같은 폴더 안의 파일은 index.js 대신 파일을 직접 import한다. 기능 사이의 순환이면 함께 쓰는 코드를 계층 폴더 바로 아래 파일로 옮긴다.',
      severity: 'error',
      from: { path: '^src/' },
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } }
    },
    {
      name: 'unresolved-package',
      comment:
        '@dfragon/database, @dfragon/neople을 package 소스로 찾지 못하면 위 두 규칙이 import type을 구분하지 못한다. tsconfig.dependency-cruiser.json의 paths를 package 진입 파일에 맞춘다.',
      severity: 'error',
      from: { path: '^src/(domain|application|presentation)/' },
      to: { couldNotResolve: true, path: '^@dfragon/(database|neople)$' }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.dependency-cruiser.json' },
    doNotFollow: { path: ['node_modules', '^\\.\\./\\.\\./packages/'] }
  }
}
