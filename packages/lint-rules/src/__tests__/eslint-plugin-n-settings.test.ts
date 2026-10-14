import { describe, expect, it } from 'vitest'
import { tryExtensionsEslintPluginNReads, typescriptSettingsEslintPluginNReads } from './eslint-plugin-n-settings.ts'

const N_LIST = ['.ts', '.js']
const NODE_LIST = ['.js', '.json']
const PRESERVE = 'preserve'
const REACT_JSX = 'react-jsx'
const TSCONFIG_PATH = 'packages/app/tsconfig.preserve.json'

describe('tryExtensionsEslintPluginNReads', () => {
  it("reads settings.n's list, before settings.node's", () => {
    expect(tryExtensionsEslintPluginNReads({ n: { tryExtensions: N_LIST }, node: { tryExtensions: NODE_LIST } })).toStrictEqual(N_LIST)
  })

  it("reads settings.node's list where settings.n holds other keys alone", () => {
    expect(tryExtensionsEslintPluginNReads({ n: { version: '>=22' }, node: { tryExtensions: NODE_LIST } })).toStrictEqual(NODE_LIST)
  })

  it("reads settings.node's list where there is no settings.n", () => {
    expect(tryExtensionsEslintPluginNReads({ node: { tryExtensions: NODE_LIST } })).toStrictEqual(NODE_LIST)
  })

  it('passes over a tryExtensions that is no array, beside one that is', () => {
    expect(tryExtensionsEslintPluginNReads({ n: { tryExtensions: '.ts' }, node: { tryExtensions: NODE_LIST } })).toStrictEqual(NODE_LIST)
  })

  it('reads nothing where neither holds a list, nor where there are no settings', () => {
    expect([tryExtensionsEslintPluginNReads({ n: { version: '>=22' }, node: {} }), tryExtensionsEslintPluginNReads(undefined)]).toStrictEqual([undefined, undefined])
  })
})

describe('typescriptSettingsEslintPluginNReads', () => {
  it("reads settings.n's typescriptExtensionMap and tsconfigPath, not settings.node's, where both hold them", () => {
    const settings = { n: { typescriptExtensionMap: PRESERVE, tsconfigPath: TSCONFIG_PATH }, node: { typescriptExtensionMap: REACT_JSX, tsconfigPath: 'tsconfig.json' } }

    expect(typescriptSettingsEslintPluginNReads(settings)).toStrictEqual({ typescriptExtensionMap: PRESERVE, tsconfigPath: TSCONFIG_PATH })
  })

  it("reads neither from settings.node where settings.n holds other keys alone, unlike tryExtensions", () => {
    const settings = { n: { tryExtensions: N_LIST }, node: { typescriptExtensionMap: PRESERVE, tsconfigPath: TSCONFIG_PATH } }

    expect(typescriptSettingsEslintPluginNReads(settings)).toStrictEqual({})
  })

  it('reads settings.node where settings.n is not set, or set to null', () => {
    const node = { typescriptExtensionMap: PRESERVE, tsconfigPath: TSCONFIG_PATH }

    expect([typescriptSettingsEslintPluginNReads({ node }), typescriptSettingsEslintPluginNReads({ n: null, node })]).toStrictEqual([node, node])
  })

  it('reads each key alone where the object holds it alone', () => {
    expect([
      typescriptSettingsEslintPluginNReads({ node: { typescriptExtensionMap: PRESERVE, version: '>=22' } }),
      typescriptSettingsEslintPluginNReads({ n: { tsconfigPath: TSCONFIG_PATH } }),
    ]).toStrictEqual([{ typescriptExtensionMap: PRESERVE }, { tsconfigPath: TSCONFIG_PATH }])
  })

  it('reads nothing where there are no settings, nor where neither key is set', () => {
    expect([typescriptSettingsEslintPluginNReads(undefined), typescriptSettingsEslintPluginNReads({ react: { version: 'detect' } })]).toStrictEqual([{}, {}])
  })
})
