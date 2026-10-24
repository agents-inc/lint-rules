import { describe, expect, it } from 'vitest'

import { housePlugin } from './index.ts'
import { repoOwnPlugin } from './repo-own-plugin.ts'

const HOUSE_RULE_NAMES = [
  'dialog-has-accessible-name',
  'hook-file-naming',
  'max-hooks-per-component',
  'named-hook-callback',
  'no-classic-loops',
  'no-controlled-field-without-change-handler',
  'no-create-context-in-render',
  'no-create-object-url-in-render',
  'no-focusable-content-in-aria-hidden',
  'no-nested-interactive',
  'no-placeholder-only-field',
  'no-section-banner',
  'no-side-effect-in-state-updater',
  'no-suppressions',
  'no-unstable-list-keys',
  'prefer-line-comments',
  'require-class-helper',
]

const REPO_OWN_RULE_NAMES = ['no-throwing-default-in-exhaustive-switch']

describe('housePlugin', () => {
  it('registers the seventeen house rules and nothing else', () => {
    expect(Object.keys(housePlugin.rules).toSorted()).toStrictEqual(HOUSE_RULE_NAMES)
  })

  it("declares the 'house' namespace", () => {
    expect(housePlugin.meta.namespace).toStrictEqual('house')
  })

  // Of ESLint's own formatters, only `json-with-metadata` prints a rule's description.
  it('gives every house rule a description', () => {
    const rulesWithoutADescription = Object.entries(housePlugin.rules)
      .filter(([, rule]) => rule.meta.docs === undefined || rule.meta.docs.description === '')
      .map(([name]) => name)

    expect(rulesWithoutADescription).toStrictEqual([])
  })
})

describe('repoOwnPlugin', () => {
  it('registers the rules this repo holds its own code to, none of them a house rule consumers get', () => {
    const names = Object.keys(repoOwnPlugin.rules)

    expect({ names: names.toSorted(), alsoHouseRules: names.filter((name) => Object.hasOwn(housePlugin.rules, name)) }).toStrictEqual({
      names: REPO_OWN_RULE_NAMES,
      alsoHouseRules: [],
    })
  })

  it("declares the 'house-repo' namespace", () => {
    expect(repoOwnPlugin.meta.namespace).toBe('house-repo')
  })

  it('gives every rule a description', () => {
    const rulesWithoutADescription = Object.entries(repoOwnPlugin.rules)
      .filter(([, rule]) => rule.meta.docs === undefined || rule.meta.docs.description === '')
      .map(([name]) => name)

    expect(rulesWithoutADescription).toStrictEqual([])
  })
})
