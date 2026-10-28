import { createRequire } from 'node:module'

/** The resets eslint-plugin-react exports beside the cache they clear. */
type ReactVersionCache = { readonly resetWarningFlag: () => void; readonly resetDetectedVersion: () => void }

// The plugin's own module, the one ESLint runs: no declaration file types what it exports.
const reactVersionCache = createRequire(import.meta.url)('eslint-plugin-react/lib/util/version') as ReactVersionCache

/** eslint-plugin-react keeps, for the whole process, the React version it detects and whether it warned that React is missing; after this, the next ESLint run reads its settings afresh. */
export function forgetWhatEslintPluginReactDetected(): void {
  reactVersionCache.resetWarningFlag()
  reactVersionCache.resetDetectedVersion()
}
