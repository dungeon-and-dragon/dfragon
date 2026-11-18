import { fileURLToPath } from 'node:url'
import sourcePaths from './tsconfig.paths.json' with { type: 'json' }

const ALIAS_WILDCARD = '/*'

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

// @dfragon/ui와 @dfragon/lib은 build 산출물을 export하므로 source로 읽는다.
export const workspaceAliases = Object.entries(sourcePaths.compilerOptions.paths).map(
  ([alias, [path]]) => {
    const exactImportPattern = `^${alias}$`
    const find = alias.endsWith(ALIAS_WILDCARD)
      ? alias.slice(0, -ALIAS_WILDCARD.length)
      : new RegExp(exactImportPattern)

    const replacement = source(path.replace(ALIAS_WILDCARD, ''))

    return { find, replacement }
  }
)
