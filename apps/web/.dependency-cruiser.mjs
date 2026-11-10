export default {
  forbidden: [
    {
      name: 'screen-folder-imports',
      comment:
        '다른 화면의 Page, Screen만 import한다. 두 화면이 쓰는 코드는 공용 components/나 hooks/에 옮긴다.',
      severity: 'error',
      from: { path: '^src/pages/([^/]+)/' },
      to: {
        path: '^src/pages/',
        pathNot: ['^src/pages/$1/', '^src/pages/[^/]+/[^/]+(Page|Screen)\\.tsx$']
      }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    doNotFollow: { path: ['node_modules', '^\\.\\./\\.\\./packages/'] }
  }
}
