import { fileURLToPath } from 'node:url'
import { catalog } from '@workspace/rule-data'
import { beforeAll, describe, expect, it } from 'vitest'
import { AGENT_BUILD, type EngineRun, type ErrorAt, type EslintMessageAt, setUpEngineRun } from './__tests__/engine-run.ts'
import { forgetWhatEslintPluginReactDetected } from './__tests__/eslint-plugin-react-version.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildErrorOnItsRoutedEngine } from './__tests__/factories/engine-error-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import {
  buildInstalledReactFiles,
  buildPackageJsonListingOthers,
  buildPackageJsonListingOxlint,
  packageJsonText,
} from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { oxlintCodeOf } from './__tests__/oxlint-codes.ts'
import { defineLintRules } from './index.ts'

// react/no-unsafe reports UNSAFE_componentWillMount from React 16.3 on. oxlint reads no installed React and,
// given no version, acts as for the newest, which reports the same: the version oxlint prints tells them apart.

/** The part of `oxlint --print-config` read here. */
type OxlintPrintedSettings = { readonly settings: { readonly react: { readonly version: string | null } } }

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/react-version', import.meta.url))
const COMPONENT_FILE = 'src/legacy.jsx'
const UNSAFE_LIFECYCLE_LINE = 4
const NO_UNSAFE = 'react/no-unsafe'
const ESLINT_ERROR = 2
const REACT_VERSION = '18.3.0'
// Below the 16.3 react/no-unsafe starts at.
const REACT_BEFORE_UNSAFE_LIFECYCLES = '16.2.0'
const REACT_LISTED = { agentRulesets: { libs: { ui: ['react'] } }, editorRulesets: { libs: { ui: ['react'] } } } as const
const LISTING_OXLINT = { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }
const LISTING_NO_OXLINT_WITH_REACT_BEFORE_UNSAFE_LIFECYCLES = {
  'package.json': packageJsonText(buildPackageJsonListingOthers()),
  ...buildInstalledReactFiles(REACT_BEFORE_UNSAFE_LIFECYCLES),
}
const TEAM_OXLINT_CONFIG_GIVING_REACT_BEFORE_UNSAFE_LIFECYCLES = buildTeamOxlintConfig({ settings: { react: { version: REACT_BEFORE_UNSAFE_LIFECYCLES } } })

function definedIn(projectDir: string): ReturnType<typeof defineLintRules> {
  return defineLintRules(buildConsumerLintRules(projectDir, REACT_LISTED))
}

function unsafeLifecycleReportsIn(run: EngineRun): ErrorAt[] {
  const noUnsafeInOxlint = oxlintCodeOf(NO_UNSAFE, catalog)
  return run.errorsOn(COMPONENT_FILE).filter(({ rule }) => rule === NO_UNSAFE || rule === noUnsafeInOxlint)
}

/** Where the build has no oxlint part, ESLint's messages alone. */
function unsafeLifecycleMessagesFromEslintIn(run: EngineRun): EslintMessageAt[] {
  return run.eslintMessagesOn(COMPONENT_FILE).filter(({ ruleId }) => ruleId === NO_UNSAFE)
}

function reactVersionOxlintPrints(run: EngineRun): string | null {
  // Parse boundary: oxlint's printed config.
  const printed = JSON.parse(run.oxlintPrint().stdout) as OxlintPrintedSettings
  return printed.settings.react.version
}

describe('a class component with an unsafe lifecycle method, the react ruleset listed, in a project whose package.json lists oxlint', () => {
  const builds = [
    { build: 'the agent build', run: setUpEngineRun(FIXTURES_DIR, definedIn, LISTING_OXLINT, AGENT_BUILD) },
    { build: 'the editor parts merged into empty team configs', run: setUpEngineRun(FIXTURES_DIR, definedIn, LISTING_OXLINT, buildEditorBuild()) },
  ]
  const besideTheTeamsVersion = setUpEngineRun(
    FIXTURES_DIR,
    definedIn,
    LISTING_OXLINT,
    buildEditorBuild({ teamOxlintConfig: TEAM_OXLINT_CONFIG_GIVING_REACT_BEFORE_UNSAFE_LIFECYCLES }),
  )

  it.each(builds)('gives oxlint React 18.3.0, in $build', ({ run }) => {
    expect(reactVersionOxlintPrints(run)).toBe(REACT_VERSION)
  })

  it.each(builds)('draws react/no-unsafe from oxlint, in $build', ({ run }) => {
    expect(unsafeLifecycleReportsIn(run)).toStrictEqual([buildErrorOnItsRoutedEngine(NO_UNSAFE, UNSAFE_LIFECYCLE_LINE)])
  })

  it("keeps the version a team's oxlint config gives, and draws no react/no-unsafe below React 16.3, in the editor parts merged into it", () => {
    expect({ version: reactVersionOxlintPrints(besideTheTeamsVersion), reports: unsafeLifecycleReportsIn(besideTheTeamsVersion) }).toStrictEqual({
      version: REACT_BEFORE_UNSAFE_LIFECYCLES,
      reports: [],
    })
  })
})

describe('a class component with an unsafe lifecycle method, the react ruleset listed, in a project whose package.json lists no oxlint and which installs React 16.2', () => {
  // First, so it runs before the engines: eslint-plugin-react would keep a version detected in the projects above, which install no React.
  beforeAll(forgetWhatEslintPluginReactDetected)
  const eslintAlone = setUpEngineRun(FIXTURES_DIR, definedIn, LISTING_NO_OXLINT_WITH_REACT_BEFORE_UNSAFE_LIFECYCLES, buildEditorBuild())

  it('draws react/no-unsafe from ESLint, as for React 18.3.0, whatever React is installed', () => {
    expect(unsafeLifecycleMessagesFromEslintIn(eslintAlone)).toStrictEqual([{ ruleId: NO_UNSAFE, severity: ESLINT_ERROR, line: UNSAFE_LIFECYCLE_LINE }])
  })
})
