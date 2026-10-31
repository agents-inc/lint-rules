const BROWSERSLIST_IGNORE_OLD_DATA = 'BROWSERSLIST_IGNORE_OLD_DATA'
// Any value but empty, which browserslist reads as unset.
const SILENCED = 'true'

/**
 * browserslist, asked in check's own process for the browsers a project names (by unicorn/no-unnecessary-polyfills,
 * for one), warns on stderr once its browser data (caniuse-lite) is six months old. check never prints that: the data
 * stays as old as the project's packages. Set whatever the run inherited, as an empty value would bring the warning back.
 */
// eslint-disable-next-line functional/no-return-void -- browserslist reads the variable from process.env when it is asked, not from anything check passes it: a value returned would silence nothing
export function silenceBrowserslistsOldDataMessage(): void {
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- as above: process.env is the only place browserslist reads it
  process.env[BROWSERSLIST_IGNORE_OLD_DATA] = SILENCED
}
