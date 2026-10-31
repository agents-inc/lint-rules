import { buildPackageJson, type PackageJson } from '../factories/package-json-factories.ts'

// A file that only re-exports, which unicorn/no-barrel-files reports and never fixes (measured: unicorn 78.0.0).

type PackageJsonNamingItsEntry = PackageJson & { readonly exports: Readonly<Record<string, string>> }

export const BARREL_RULE = 'unicorn/no-barrel-files'

/** The package's main entry, as its package.json's `exports["."]` names it. */
export const MAIN_ENTRY_FILE = 'src/index.ts'

/** A barrel that is no package's entry. */
export const OTHER_BARREL_FILE = 'src/components/index.ts'

/** The module both barrels re-export. */
export const RE_EXPORTED_FILE = 'src/greeting.ts'

export const RE_EXPORTED_MODULE = "export const greeting = 'hello'"

export const MAIN_ENTRY_BARREL = "export { greeting } from './greeting.ts'"

export const OTHER_BARREL = "export { greeting } from '../greeting.ts'"

export function buildPackageJsonNamingItsMainEntry(): PackageJsonNamingItsEntry {
  return { ...buildPackageJson(), exports: { '.': `./${MAIN_ENTRY_FILE}` } }
}
