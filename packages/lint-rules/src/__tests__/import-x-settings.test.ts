import { describe, expect, it } from 'vitest'
import { resolversImportXReads } from './import-x-settings.ts'

const OURS = { interfaceVersion: 3, name: 'eslint-plugin-import-x:node' }
const THEIRS = { interfaceVersion: 3, name: 'team-resolver' }
const LEGACY = { node: { extensions: ['.ts', '.js'] } }
const OTHER_LEGACY = { typescript: true }
const NODE_OPTIONS = { extensions: ['.ts'] }

describe('resolversImportXReads', () => {
  it('reads resolver-next, by each resolver\'s name, before every legacy key', () => {
    const settings = { 'import-x/resolver-next': [OURS, THEIRS], 'import-x/resolver-legacy': LEGACY, 'import-x/resolver': OTHER_LEGACY, 'import-x/resolve': NODE_OPTIONS }

    expect(resolversImportXReads(settings)).toStrictEqual({ key: 'import-x/resolver-next', names: [OURS.name, THEIRS.name] })
  })

  it('reads one resolver given to resolver-next outside a list, and names one with no name as unnamed', () => {
    expect([
      resolversImportXReads({ 'import-x/resolver-next': THEIRS }),
      resolversImportXReads({ 'import-x/resolver-next': [{ interfaceVersion: 3 }] }),
    ]).toStrictEqual([
      { key: 'import-x/resolver-next', names: [THEIRS.name] },
      { key: 'import-x/resolver-next', names: ['unnamed'] },
    ])
  })

  it('reads resolver-legacy before resolver, where resolver-next holds nothing', () => {
    expect([
      resolversImportXReads({ 'import-x/resolver-legacy': LEGACY, 'import-x/resolver': OTHER_LEGACY }),
      resolversImportXReads({ 'import-x/resolver-next': null, 'import-x/resolver': OTHER_LEGACY }),
    ]).toStrictEqual([
      { key: 'import-x/resolver-legacy', value: LEGACY },
      { key: 'import-x/resolver', value: OTHER_LEGACY },
    ])
  })

  it("reads resolve's node options where no resolver key holds anything, and nothing of them where there are no settings", () => {
    expect([resolversImportXReads({ 'import-x/resolve': NODE_OPTIONS, 'import-x/resolver': '' }), resolversImportXReads(undefined)]).toStrictEqual([
      { key: 'import-x/resolve', value: NODE_OPTIONS },
      { key: 'import-x/resolve', value: undefined },
    ])
  })
})
