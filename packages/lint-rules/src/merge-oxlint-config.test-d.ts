// Never run: typecheck fails when an `@ts-expect-error` below stops meeting a type error, or an allowed call beside it
// stops compiling. mergeOxlintConfig refuses only by these types the wrong part as its second argument, and a third
// argument that is not the path of the team's ESLint config or null: no check of ours refuses either at run time (owner,
// 2026-10-20). What an untyped oxlint.config.mts gets instead: untyped-oxlint-config.test.ts.
import { buildEveryRulesetLintRules, EMPTY_TSCONFIG_ROOT_DIR } from './__tests__/factories/lint-rules-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_ESLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import type { EslintPart, OxlintPart } from './core/editor-parts.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

const ESLINT_CONFIG_FILE = 'eslint.config.mjs'

const { editorRulesets } = defineLintRules(buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR))
const { eslint, oxlint } = editorRulesets
const theirs = buildTeamOxlintConfig()

/** Whichever part a team's file picks at run time. */
declare const EITHER_PART: EslintPart | OxlintPart
/** As a team's file may receive it from a helper typed loosely. */
declare const PATH_HELD_IN_A_STRING: string

const ESLINT_PART_AS_A_RECORD: Record<string, unknown> = { ...eslint }
const ESLINT_PART_AS_AN_OBJECT: object = eslint
const PATH_WHOSE_KEY_IS_OPTIONAL: { readonly eslintConfig?: string } = {}
const PATH_AS_A_RECORD: Record<string, unknown> = { eslintConfig: ESLINT_CONFIG_FILE }
const PATH_AS_A_RECORD_OF_PATHS: Record<string, string | null> = { eslintConfig: ESLINT_CONFIG_FILE }

// The second argument is the oxlint part agents-inc.lint.mts exports, undefined where the project lists no oxlint (which
// the merge refuses as it runs, naming package.json), or a copy of it.
mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG)

mergeOxlintConfig(theirs, undefined, NO_TEAM_ESLINT_CONFIG)

if (oxlint !== undefined) mergeOxlintConfig(theirs, { ...oxlint }, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not the ESLint part
mergeOxlintConfig(theirs, eslint, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not a copy of the ESLint part
mergeOxlintConfig(theirs, { ...eslint }, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part: the ESLint part with oxlint's engine written over it still lacks turnedOnInEslint
mergeOxlintConfig(theirs, { ...eslint, engine: 'oxlint' }, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not the object holding both parts, written in place
mergeOxlintConfig(theirs, { eslint, oxlint }, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not the object holding both parts
mergeOxlintConfig(theirs, editorRulesets, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not a value that may be either part
mergeOxlintConfig(theirs, EITHER_PART, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not the ESLint part copied into a Record
mergeOxlintConfig(theirs, ESLINT_PART_AS_A_RECORD, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not the ESLint part typed object
mergeOxlintConfig(theirs, ESLINT_PART_AS_AN_OBJECT, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not null
mergeOxlintConfig(theirs, null, NO_TEAM_ESLINT_CONFIG)

// @ts-expect-error mergeOxlintConfig takes the oxlint part, not a string
mergeOxlintConfig(theirs, 'oxlint', NO_TEAM_ESLINT_CONFIG)

// The third argument names the team's ESLint config, relative to tsconfigRootDir, or null where it has none.
mergeOxlintConfig(theirs, oxlint, { eslintConfig: ESLINT_CONFIG_FILE })

mergeOxlintConfig(theirs, oxlint, { eslintConfig: null })

mergeOxlintConfig(theirs, oxlint, { eslintConfig: PATH_HELD_IN_A_STRING })

// @ts-expect-error the path of the team's ESLint config is required
mergeOxlintConfig(theirs, oxlint)

// @ts-expect-error eslintConfig is required
mergeOxlintConfig(theirs, oxlint, {})

// @ts-expect-error eslintConfig is required: eslintconfig is no key of it
mergeOxlintConfig(theirs, oxlint, { eslintconfig: null })

// @ts-expect-error eslintConfig is required: oxlintConfig is the ESLint merge's key
mergeOxlintConfig(theirs, oxlint, { oxlintConfig: null })

// @ts-expect-error eslintConfig is a path or null, not a number
mergeOxlintConfig(theirs, oxlint, { eslintConfig: 42 })

// @ts-expect-error eslintConfig is a path or null, not a boolean
mergeOxlintConfig(theirs, oxlint, { eslintConfig: true })

// @ts-expect-error eslintConfig is a path or null, not a list of paths
mergeOxlintConfig(theirs, oxlint, { eslintConfig: [ESLINT_CONFIG_FILE] })

// @ts-expect-error eslintConfig is a path or null, not an object naming one
mergeOxlintConfig(theirs, oxlint, { eslintConfig: { path: ESLINT_CONFIG_FILE } })

// @ts-expect-error eslintConfig is a path or null, not undefined
mergeOxlintConfig(theirs, oxlint, { eslintConfig: undefined })

// @ts-expect-error the third argument is an object holding the path, not the path
mergeOxlintConfig(theirs, oxlint, ESLINT_CONFIG_FILE)

// @ts-expect-error the third argument is an object holding the path, not null
mergeOxlintConfig(theirs, oxlint, null)

// @ts-expect-error eslintConfig is required, not optional
mergeOxlintConfig(theirs, oxlint, PATH_WHOSE_KEY_IS_OPTIONAL)

// @ts-expect-error eslintConfig is required: a Record may not hold it
mergeOxlintConfig(theirs, oxlint, PATH_AS_A_RECORD)

// @ts-expect-error eslintConfig is required: a Record of paths may not hold it
mergeOxlintConfig(theirs, oxlint, PATH_AS_A_RECORD_OF_PATHS)
