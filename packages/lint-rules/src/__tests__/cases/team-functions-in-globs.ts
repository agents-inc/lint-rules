// Team ESLint config modules holding a function where ESLint takes globs, which ESLint 10 accepts though its
// types do not. Only JS can write them without a cast, as a team's eslint.config.mjs does.

export const FUNCTION_CASE_MODULE = 'team-functions.mjs'

/** Global ignores leaving dist/ out, and, by a function, legacy/: a function takes no file back. */
export const GLOBAL_IGNORES_HOLDING_A_FUNCTION = `export const teamConfig = [
  { name: 'team/global-ignores', ignores: ['dist/', (filePath) => filePath.includes('/legacy/')] },
]
`

export const SETTINGS_FOR_FILES_A_FUNCTION_NAMES = `export const teamConfig = [
  { name: 'team/node-settings', files: [(filePath) => filePath.includes('/legacy/')], settings: { node: { tryExtensions: ['.js', '.ts'] } } },
]
`

export const SETTINGS_FOR_TS_FILES_A_FUNCTION_NAMES = `export const teamConfig = [
  { name: 'team/node-settings', files: [['**/*.ts', (filePath) => filePath.includes('/legacy/')]], settings: { node: { tryExtensions: ['.js', '.ts'] } } },
]
`
