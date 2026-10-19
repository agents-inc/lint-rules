import { ESLint, type Linter } from 'eslint'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { forgetWhatEslintPluginReactDetected } from './__tests__/eslint-plugin-react-version.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildInstalledReactFiles, buildPackageJsonListingOthers, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// Our settings give eslint-plugin-react React 18.3.0, whatever the project installs, so it prints nothing.
// The plugin warns once per process and caches the detected version, so each case resets both first, or a
// spy finding nothing would prove nothing.

const REACT_VERSION = '18.3.0'
const DETECT = 'detect'
const MISSING_REACT_WARNING =
  'Warning: React version was set to "detect" in eslint-plugin-react settings, but the "react" package is not installed. Assuming latest React version for linting.'
const INSTALLED_REACT_VERSION = '19.2.0'
const JSX_FILE = 'src/app.jsx'
const JSX_SOURCE = 'export const App = () => <div />\n'
const REACT_LISTED = { quality: [], libs: { ui: ['react'] } } as const

// react/no-render-return-value reads the React version as it starts on each file (lib/rules/no-render-return-value.js),
// so this block makes the plugin read it in every build, whichever of the plugin's rules our sets run.
const BLOCK_READING_THE_REACT_VERSION: Linter.Config = { name: 'test/reads-the-react-version', files: ['**/*.jsx'], rules: { 'react/no-render-return-value': 'error' } }
const BLOCK_DETECTING_THE_REACT_VERSION: Linter.Config = { name: 'test/detects-the-react-version', settings: { react: { version: DETECT } } }

type Build = { readonly build: string; readonly configOf: (projectDir: string) => Linter.Config[] }

// The project lists no oxlint, so the editor merge has no third config to read.
const BUILDS: readonly Build[] = [
  { build: 'agent build', configOf: (projectDir) => agentConfigsOf(definedIn(projectDir)).eslint },
  { build: 'ESLint merge', configOf: (projectDir) => mergeEslintConfig([], definedIn(projectDir).editorRulesets.eslint, NO_TEAM_OXLINT_CONFIG) },
]

const tempProjects = setUpTempProjects()
const { calculatedConfigInProjectFor } = setUpEslintConfigOracle()
const PROJECT_WITHOUT_REACT = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()), [JSX_FILE]: JSX_SOURCE } })
const PROJECT_WITH_REACT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()), [JSX_FILE]: JSX_SOURCE, ...buildInstalledReactFiles(INSTALLED_REACT_VERSION) },
})

function definedIn(projectDir: string): ReturnType<typeof defineLintRules> {
  return defineLintRules(buildConsumerLintRules(projectDir, { agentRulesets: REACT_LISTED, editorRulesets: REACT_LISTED }))
}

async function lintTheJsxFile(projectDir: string, config: readonly Linter.Config[]): Promise<void> {
  await new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: [...config] }).lintFiles([JSX_FILE])
}

async function reactSettingFor(projectDir: string, config: Linter.Config[]): Promise<unknown> {
  const calculated = await calculatedConfigInProjectFor(projectDir, config, JSX_FILE)
  if (calculated === undefined) throw new Error(`ESLint does not lint ${JSX_FILE}`)
  const { settings } = calculated
  if (settings === undefined) throw new Error(`no settings apply to ${JSX_FILE}`)
  return settings['react']
}

describe("eslint-plugin-react's React version, as our settings give it", () => {
  let printed: MockInstance<typeof console.error>

  beforeEach(() => {
    forgetWhatEslintPluginReactDetected()
    printed = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    printed.mockRestore()
  })

  it.each(BUILDS)('prints nothing for a JSX file in a project without React, in the $build', async ({ configOf }) => {
    await lintTheJsxFile(PROJECT_WITHOUT_REACT, [...configOf(PROJECT_WITHOUT_REACT), BLOCK_READING_THE_REACT_VERSION])

    expect(printed.mock.calls).toStrictEqual([])
  })

  // The control beside it: the same run, its setting `detect`, prints the warning, so the spy sees it.
  it.each(BUILDS)('prints the missing-React warning there where the setting is detect, in the $build', async ({ configOf }) => {
    await lintTheJsxFile(PROJECT_WITHOUT_REACT, [...configOf(PROJECT_WITHOUT_REACT), BLOCK_READING_THE_REACT_VERSION, BLOCK_DETECTING_THE_REACT_VERSION])

    expect(printed.mock.calls).toStrictEqual([[MISSING_REACT_WARNING]])
  })

  it.each(BUILDS)('prints nothing for a JSX file in a project with React installed, in the $build', async ({ configOf }) => {
    await lintTheJsxFile(PROJECT_WITH_REACT, [...configOf(PROJECT_WITH_REACT), BLOCK_READING_THE_REACT_VERSION])

    expect(printed.mock.calls).toStrictEqual([])
  })

  it.each(BUILDS)('is React 18.3.0 whether React is installed or not, in the $build', async ({ configOf }) => {
    expect({
      withoutReact: await reactSettingFor(PROJECT_WITHOUT_REACT, configOf(PROJECT_WITHOUT_REACT)),
      withReact: await reactSettingFor(PROJECT_WITH_REACT, configOf(PROJECT_WITH_REACT)),
    }).toStrictEqual({ withoutReact: { version: REACT_VERSION }, withReact: { version: REACT_VERSION } })
  })
})
