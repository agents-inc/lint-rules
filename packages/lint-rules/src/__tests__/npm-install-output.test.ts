import { describe, expect, it } from 'vitest'
import { buildNpmInstalledSummary, buildNpmPeerOverrideNamingNoPackage, buildNpmPeerOverrideWarning } from './factories/npm-output-factories.ts'
import { packagesNpmOverridesAPeerFor } from './npm-install-output.ts'

const PACKAGES_INSTALLED = 120
const REACT = { packageName: 'eslint-plugin-react', version: '7.37.5', peerRange: '^8 || ^9.7' }
const REACT_PERF = { packageName: 'eslint-plugin-react-perf', version: '3.3.3', peerRange: '^9' }
const SCOPED = { packageName: '@team/eslint-plugin', version: '2.0.0', peerRange: '^9' }

describe('packagesNpmOverridesAPeerFor', () => {
  it('reads each package npm overrides a peer for, once each and sorted, however often npm names it', () => {
    const output = [REACT_PERF, REACT, REACT_PERF].map(buildNpmPeerOverrideWarning).join('\n') + buildNpmInstalledSummary(PACKAGES_INSTALLED)

    expect(packagesNpmOverridesAPeerFor(output)).toStrictEqual(['eslint-plugin-react', 'eslint-plugin-react-perf'])
  })

  it("reads a scoped package's name without its version", () => {
    expect(packagesNpmOverridesAPeerFor(buildNpmPeerOverrideWarning(SCOPED))).toStrictEqual(['@team/eslint-plugin'])
  })

  // The allowed case beside the refusal below: an install that overrides nothing.
  it('reads none from an install that overrode no peer', () => {
    expect(packagesNpmOverridesAPeerFor(buildNpmInstalledSummary(PACKAGES_INSTALLED))).toStrictEqual([])
  })

  it('refuses an override whose next line names no package resolved, rather than reading none', () => {
    expect(() => packagesNpmOverridesAPeerFor(buildNpmPeerOverrideNamingNoPackage())).toThrowError(
      'npm opened a peer override without naming the package resolved: npm warn Found: eslint@10.12.0',
    )
  })
})
